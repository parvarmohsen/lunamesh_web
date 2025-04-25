/// <reference types="@types/web-bluetooth" />
/// <reference types="@types/w3c-web-serial" />

export {};

declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
    serial?: Serial;
  }
}
