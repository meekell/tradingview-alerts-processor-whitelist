import express = require('express');
import { NODE_PORT } from './constants/env.constants';
import { info, warning } from './services/logger.service';
import {
  SERVER_RUNNING,
  GREETINGS,
  ISSUES,
  DISCLAIMER
} from './messages/server.messages';
import { DatabaseService } from './services/db/db.service';
import { errorMiddleware } from './utils/errors.utils';
import routes from './routes';
import IpFilter = require('express-ipfilter');

const app = express();
const ipfilter = IpFilter.IpFilter;

const PORT = process.env.PORT || NODE_PORT;

// Allow the following IPs
const ips = [
  '127.0.0.1',
  '::1',
  '52.89.214.238',
  '34.212.75.30',
  '54.218.53.128',
  '52.32.178.7'
];

// Create the server
app.use(ipfilter(ips, { mode: 'allow' }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(errorMiddleware);

app.use(routes.accounts);
app.use(routes.trading);
app.use(routes.health);
app.use(routes.markets);
app.use(routes.balances);

app.listen(PORT, () => {
  info(GREETINGS);
  warning(ISSUES);
  warning(DISCLAIMER);
  DatabaseService.getDatabaseInstance();
  info(SERVER_RUNNING);
});
