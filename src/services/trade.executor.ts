import { Order } from 'ccxt';
import {
  TRADE_EXECUTION_ERROR,
  TRADE_EXECUTION_SUCCESS,
  TRADE_EXECUTION_TIME,
  TRADE_SERVICE_ADD,
  TRADE_SERVICE_START,
  TRADE_SERVICE_STOP
} from '../messages/trade.messages';
import { Side } from '../constants/trade.constants';
import { Account } from '../entities/account.entities';
import { Trade } from '../entities/trade.entities';
import { ITradeInfo } from '../interfaces/trade.interface';

import { error, debug, info } from './logger.service';
import { TradeExecutionError } from '../errors/exchange.errors';
import {
  TRADE_SERVICE_ALREADY_STARTED,
  TRADE_SERVICE_ALREADY_STOPPED
} from '../messages/trade.messages';
import {
  DELAY_BETWEEN_TRADES,
  ExchangeId
} from '../constants/exchanges.constants';
import { ExchangeService } from '../types/exchanges.types';
import { BinanceFuturesUSDMExchangeService } from '../services/exchanges/binance-usdm.futures.exchange.service';
import { BinanceSpotExchangeService } from '../services/exchanges/binance.spot.exchange.service';
import { FTXExchangeService } from '../services/exchanges/ftx.exchange.service';

export const initExchangeService = (
  exchangeId: ExchangeId
): ExchangeService => {
  switch (exchangeId) {
    case ExchangeId.Binance:
      return new BinanceSpotExchangeService();
    case ExchangeId.BinanceFuturesUSD:
      return new BinanceFuturesUSDMExchangeService();
    case ExchangeId.FTX:
    default:
      return new FTXExchangeService();
  }
};

export class TradingExecutor {
  private isStarted = false;
  private executionLoop: NodeJS.Timeout;
  private id: ExchangeId;
  private exchangeService: ExchangeService;
  private trades: ITradeInfo[] = [];

  constructor(id: ExchangeId) {
    this.id = id;
    this.exchangeService = initExchangeService(id);
  }

  getExchangeService = (): ExchangeService => this.exchangeService;

  getStatus = (): boolean => this.isStarted;

  start = (): void => {
    if (!this.isStarted) {
      debug(TRADE_SERVICE_START(this.id));
      this.executionLoop = setInterval(() => {
        const tradeInfo = this.trades.shift();
        if (tradeInfo) {
          const { account, trade } = tradeInfo;
          this.processTrade(account, trade);
        }
      }, DELAY_BETWEEN_TRADES[this.id]);
      this.isStarted = true;
    } else {
      debug(TRADE_SERVICE_ALREADY_STARTED(this.id));
    }
  };

  stop = (): void => {
    if (this.isStarted) {
      debug(TRADE_SERVICE_STOP(this.id));
      clearInterval(this.executionLoop);
      this.isStarted = false;
    } else {
      debug(TRADE_SERVICE_ALREADY_STOPPED(this.id));
    }
  };

  addTrade = async (account: Account, trade: Trade): Promise<boolean> => {
    const { stub, exchange } = account;
    const { symbol, direction } = trade;
    try {
      debug(TRADE_SERVICE_ADD(exchange));
      this.trades.push({ account, trade });
      debug(TRADE_EXECUTION_SUCCESS(exchange, stub, symbol, direction));
    } catch (err) {
      error(TRADE_EXECUTION_ERROR(exchange, stub, symbol, direction), err);
      throw new TradeExecutionError(
        TRADE_EXECUTION_ERROR(exchange, stub, symbol, direction, err.message)
      );
    }
    return true;
  };

  processTrade = async (account: Account, trade: Trade): Promise<Order> => {
    const { direction } = trade;
    try {
      const start = new Date();
      const order =
        direction === Side.Close
          ? await this.exchangeService.closeOrder(account, trade)
          : await this.exchangeService.openOrder(account, trade);
      const end = new Date();
      info(TRADE_EXECUTION_TIME(start, end));
      return order;
    } catch (err) {
      // ignore
    }
  };
}
