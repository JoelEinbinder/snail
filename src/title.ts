import { UIThrottle } from "./UIThrottle";

function onChange() {
    document.title = titleThrottle.value + suffixThrottle.value;
}
export const suffixThrottle = new UIThrottle('', onChange); 
export const titleThrottle = new UIThrottle('Loading...', onChange);
