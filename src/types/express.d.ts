import { Request } from 'express';

// Augment Express types to make params always return string
declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    [key: string]: string;
  }
}
