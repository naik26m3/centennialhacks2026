/// <reference types="nativewind/types" />

// The root layout imports global.css purely for its side effect (Metro feeds it
// through the NativeWind transform); TypeScript needs to be told it's importable.
declare module "*.css";
