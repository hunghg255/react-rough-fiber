import { Options, InterceptProps } from './types';
import {
  SVG_INTERCEPT_ATTRIBUTE,
  SVG_PATH_TAG,
  SVG_FILL,
  REACT_INTERNAL_PROPS_KEY_START,
  OLD_REACT_INTERNAL_PROPS_KEY_START,
  SVG_D,
} from './constants';
import { shape2path } from './shape2path';
import {
  shallowEqual,
  fakeSet,
  shouldInterceptAttribute,
  createProxyHandler,
} from './utils';

export class FakeCore {
  private realContainer: Element;
  private fakeDocument: Document;
  private fakeSVGElementSet: Set<Element>;
  private options: Options | undefined;
  private shouldForceOptionsChange: boolean;
  private couldMergeUpdate = false;
  public readonly fakeContainer: Element;
  constructor(
    domElement: Element,
    shouldForceOptionsChange = false,
    options?: Options
  ) {
    this.realContainer = domElement;
    // How to force update after rough options change:
    // collect all relevant elements in advance.
    // and update them after rough options change.
    this.shouldForceOptionsChange = shouldForceOptionsChange;
    this.fakeSVGElementSet = shouldForceOptionsChange
      ? new Set()
      : (fakeSet as any as Set<Element>);
    this.options = options;
    this.fakeDocument = this.createFakeDocument() as Document;

    // Detect if we could merge update.
    // How to merge update:
    // react will set a prop to the element with the prefix `__reactProps$` .
    // we can use proxy to know when `__reactProps$` is set.
    // we calculate the path using `shape2path` and set it to `d` attribute when `__reactProps$` is set.
    // if we could merge update, we should skip `setAttribute` and `removeAttribute` for keys of SVG_INTERCEPT_ATTRIBUTE[type].
    // How to detect if we could merge update:
    // try to get `__reactProps$` prefix key from domElement, if it exists, we could merge update.
    Object.keys(domElement).forEach((key) => {
      if (
        key.startsWith(REACT_INTERNAL_PROPS_KEY_START) ||
        key.startsWith(OLD_REACT_INTERNAL_PROPS_KEY_START)
      ) {
        this.couldMergeUpdate = true;
      }
    });

    this.fakeContainer = this.createFakeElement(domElement) as Element;
  }

  private createFakeDocument() {
    const realOwnerDocument = this.realContainer.ownerDocument;
    const doc = {
      createElementNS: (ns: string, type: string) => {
        if (type.toLowerCase() in SVG_INTERCEPT_ATTRIBUTE) {
          const el = realOwnerDocument.createElementNS(ns, SVG_PATH_TAG);
          const fakeElement = this.createFakeElement(el, type);
          // collect svg elements in order to update them later(shouldForceOptionsChange = true).
          this.fakeSVGElementSet.add(fakeElement as Element);
          return fakeElement;
        } else {
          return this.createFakeElement(
            realOwnerDocument.createElementNS(ns, type)
          );
        }
      },
      createElement: (type: string) => {
        const el = realOwnerDocument.createElement(type);
        return this.createFakeElement(el);
      },
    };
    const handler = createProxyHandler(realOwnerDocument);
    return new Proxy(doc, handler);
  }

  private createFakeElement(element: Element, _type?: string) {
    const type = _type || element.tagName;
    const { fakeSVGElementSet, couldMergeUpdate } = this;
    let interceptedAttrs: InterceptProps | null = null;
    const el = {
      __originalType: type,
      __realElement: element,
      __commitUpdate: () => {
        element.setAttribute(
          SVG_D,
          shape2path(type, interceptedAttrs || {}, this.options)
        );
      },
      // react use the ownerDocument to create elements, so we need to override it.
      ownerDocument: this.fakeDocument,
      appendChild: (child: Element) => {
        if ('__realElement' in child && '__originalType' in child) {
          element.appendChild(child.__realElement as Element);
          if (
            (child.__originalType as string).toLowerCase() in
            SVG_INTERCEPT_ATTRIBUTE
          ) {
            fakeSVGElementSet.add(child);
          }
          (child as any).__commitUpdate();
        } else {
          element.appendChild(child);
        }
      },
      removeChild(child: Element) {
        if ('__realElement' in child) {
          element.removeChild(child.__realElement as Element);
          fakeSVGElementSet.delete(child);
        } else {
          element.removeChild(child);
        }
      },
      insertBefore: (child: Element, before: Element) => {
        if ('__realElement' in child && '__originalType' in child) {
          if ('__realElement' in before && '__originalType' in before) {
            element.insertBefore(
              child.__realElement as Element,
              before.__realElement as Element
            );
          } else {
            element.insertBefore(child.__realElement as Element, before);
          }
          (child as any).__commitUpdate();
        } else {
          if ('__realElement' in before && '__originalType' in before) {
            element.insertBefore(child, before.__realElement as Element);
          } else {
            element.insertBefore(child, before);
          }
        }
      },
      setAttribute(name: string, value: string) {
        if (!shouldInterceptAttribute(type, name)) {
          element.setAttribute(name, value);
        } else {
          // `fill` attribute should be set to the element directly.
          if (name === SVG_FILL) {
            element.setAttribute(name, value);
          }
          if (!couldMergeUpdate) {
            if (!interceptedAttrs) {
              interceptedAttrs = {};
            }
            interceptedAttrs[name] = value;
            // If the element has not been appended to the parent, do not need to update it.
            element.parentNode && this.__commitUpdate();
          }
        }
      },
      removeAttribute(name: string) {
        if (!shouldInterceptAttribute(type, name)) {
          element.removeAttribute(name);
        } else {
          if (name === SVG_FILL) {
            element.removeAttribute(name);
          }
          if (!couldMergeUpdate) {
            delete interceptedAttrs![name];
            // The node has been appended to parent
            this.__commitUpdate();
          }
        }
      },
    };

    const setCallback = (name: string, value: any) => {
      if (
        element.parentNode &&
        (name.startsWith(REACT_INTERNAL_PROPS_KEY_START) ||
          name.startsWith(OLD_REACT_INTERNAL_PROPS_KEY_START))
      ) {
        const nextAttrs: InterceptProps = {};
        Object.keys(
          SVG_INTERCEPT_ATTRIBUTE[type as keyof typeof SVG_INTERCEPT_ATTRIBUTE]
        ).forEach((attr) => {
          if (Object.prototype.hasOwnProperty.call(value, attr)) {
            nextAttrs[attr] = value[attr as keyof typeof value];
          }
        });
        if (!shallowEqual(nextAttrs, interceptedAttrs)) {
          interceptedAttrs = nextAttrs;
          el.__commitUpdate();
        }
      }
    };

    const handler = createProxyHandler(
      element,
      couldMergeUpdate && type in SVG_INTERCEPT_ATTRIBUTE
        ? setCallback
        : undefined
    );
    return new Proxy(el, handler);
  }

  private forceUpdate() {
    this.fakeSVGElementSet.forEach((el) => {
      (el as any).__commitUpdate();
    });
  }

  public updateRoughOptions(options: Options | undefined) {
    if (!shallowEqual(this.options, options)) {
      this.options = options;
      if (this.shouldForceOptionsChange) {
        this.forceUpdate();
      }
    }
  }
}