export function setNativeValue(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string
) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    const nativeSetter = descriptor ? descriptor.set : null;

    if (nativeSetter) {
        nativeSetter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
        element.value = value;
    }
}

export function setNativeChecked(element: HTMLInputElement, checked: boolean) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "checked");
    const nativeSetter = descriptor ? descriptor.set : null;

    if (nativeSetter) {
        nativeSetter.call(element, checked);
        element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
        element.checked = checked;
    }
}
