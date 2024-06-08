import { Chart, Line } from '../src/charts/Chart';
const chart = new Chart();
document.body.append(chart.element);
const line = new Line()
chart.addLine(line);
window['chart'] = chart;
window['line'] = line;
