import {messages as first} from './locales/part-1.js';
import {messages as second} from './locales/part-2.js';
import {messages as third} from './locales/part-3.js';
import {messages as extra} from './locales/extra.js';
import {messages as ssrExtra} from './locales/ssr-extra.js';

import {messages as composed1} from './locales/composed-1.js';
import {messages as composed2} from './locales/composed-2.js';
import {messages as composed3} from './locales/composed-3.js';
import {messages as rich} from './locales/rich.js';
import {messages as remaining} from './locales/remaining.js';
import {messages as validation} from './locales/validation.js';
import {messages as reviewed} from './locales/reviewed.js';

export const messages = {...first, ...second, ...third, ...extra, ...ssrExtra, ...composed1, ...composed2, ...composed3, ...rich, ...remaining, ...validation, ...reviewed};
