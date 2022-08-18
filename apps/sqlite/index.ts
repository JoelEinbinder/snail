/// <reference path="../../iframe/types.d.ts" />
import {DataGrid} from '../../datagrid/datagrid';
const {rows} = await d4.waitForMessage<{
  rows: {[key: string]: any}[];
}>();

const datagrid = new DataGrid<{[key: string]: any}>(Object.keys(rows[0]).map(key => ({
  render(item) {
    const element = document.createElement('span');
    element.textContent = JSON.stringify(item[key]);
    return element;
  },
  title: key,
})), {
  async loadItem() {
    return undefined;
  },
  saveItem() {
  }
});
await datagrid.loadAllData();
datagrid.setItems(rows);
document.body.append(datagrid.element);
d4.setHeight(document.body.offsetHeight);
