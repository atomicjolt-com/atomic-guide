import 'vite/client';

export interface ResponseError {
  message: string;
}

// CSS Modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// CSS files
declare module '*.css' {
  const css: string;
  export default css;
}
