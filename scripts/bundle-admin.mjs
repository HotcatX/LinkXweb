import { cp } from 'node:fs/promises';
await cp(new URL('../admin/dist/',import.meta.url),new URL('../dist-cloudbase/admin/',import.meta.url),{recursive:true});
console.log('Authenticated admin included at /admin/.');
