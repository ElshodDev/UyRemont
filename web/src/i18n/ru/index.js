// Ruscha tarjimalar: har bir bo'lim alohida faylda (o'zbekcha matn -> ruscha matn)
import common from './common.js';
import shell from './shell.js';
import client from './client.js';
import master from './master.js';

export default {
  ...common,
  ...shell,
  ...client,
  ...master
};
