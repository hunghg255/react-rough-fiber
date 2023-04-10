import { RoughSVG } from 'react-rough-fiber';
import { BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

const data = [
  {
    name: 'Page A',
    uv: 9000,
    pv: 2400,
  },
  {
    name: 'Page B',
    uv: 3000,
    pv: 1398,
  },
  {
    name: 'Page C',
    uv: 2000,
    pv: 9800,
  },
  {
    name: 'Page D',
    uv: 2780,
    pv: 3908,
  },
  {
    name: 'Page E',
    uv: 1890,
    pv: 4800,
  },
  {
    name: 'Page F',
    uv: 2390,
    pv: 3800,
  },
  {
    name: 'Page G',
    uv: 3490,
    pv: 4300,
  },
];

export const ChartDemo = () => (
  <RoughSVG
    className="my-4"
    roughOptions={{ fillStyle: 'zigzag' }}
    style={{ fontFamily: 'HandDrawnFont' }}
  >
    <BarChart width={730} height={250} data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="pv" fill="#8884d8" stroke="currentColor" />
      <Bar dataKey="uv" fill="#82ca9d" stroke="currentColor" />
    </BarChart>
  </RoughSVG>
);