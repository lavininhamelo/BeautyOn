declare module 'date-fns' {
  export const startOfHour: any;
  export const parseISO: any;
  export const isBefore: any;
  export const format: any;
  export const subHours: any;

  export const startOfDay: any;
  export const endOfDay: any;
  export const setHours: any;
  export const setMinutes: any;
  export const setSeconds: any;
  export const isAfter: any;
}

declare module 'date-fns/*' {
  const anyExport: any;
  export default anyExport;
}

