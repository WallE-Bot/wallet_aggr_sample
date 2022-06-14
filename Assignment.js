const Web3 = require('web3');
const fetch = require('node-fetch');
const { ABI } = require('./ABI');
const { fetchRate1Inch, fetchRateDEX } = require('./helpers');
const { ADDRESS } = require('./address');
const { INFURA } = require('./key');
const { CONTRACT_NAMES, TOKEN_NAMES } = require('./constants');
const { ethers, aBigNumberish } = require('ethers');

class Assignment {

  /*
    web3Provider and web3 instances maintained in case required
    CONTRACTS = { [name]: instance }
    WALLET_BALANCE = { [token]: balance }
    RESULT = max wallet value
  */
  constructor() {
    this.TOKEN_CALL_DATA = {
      'SHI3LD': {
        'fromTokenAddress': ADDRESS.SHI3LD,
        'toTokenAddress': ADDRESS.DAI,
        'amount': 0,
      },
      'KOGE': {
        'fromTokenAddress': ADDRESS.KOGE,
        'toTokenAddress': ADDRESS.DAI,
        'amount': 0,
      },
      'PEAR': {
        'fromTokenAddress': ADDRESS.PEAR,
        'toTokenAddress': ADDRESS.DAI,
        'amount': 0,
      },
      'SING': {
        'fromTokenAddress': ADDRESS.SING,
        'toTokenAddress': ADDRESS.DAI,
        'amount': 0,
      },
    };

    this.TOKEN_SWAP_RATES = {
      '1inch': {},
      'CafeSwap': {},
      'ApeSwap': {}
    }
  }

   async initialize () {
    // initialize Web3 instance
    this.web3Provider = new Web3.providers.HttpProvider(INFURA);
    this.web3 = new Web3(this.web3Provider);
    this.BigNumber = ethers.BigNumber;

    // initialize contracts
    this.CONTRACTS = CONTRACT_NAMES.reduce((contracts, name) => {
      try {
        contracts[name] = new this.web3.eth.Contract(
          ABI[name],
          ADDRESS[name]
        );
      } catch(err) {
        console.error(
          `Unable to create contract instance for ${name}`,
          err
        );
      }
      return contracts;
    }, {});

    // initialize wallet token balances and
    // populate token API call data token mounts
    this.WALLET_BALANCE = TOKEN_NAMES.reduce(async (walletBalance, name) => {
      try {
        await this.CONTRACTS[name]
          .methods.balanceOf(ADDRESS.USER_WALLET)
          .call((err, res) => {
            console.log(err, res);
            walletBalance[name] = res;
            this.TOKEN_CALL_DATA[name]['amount'] = res;
          });
      } catch(err) {
        console.error(
          `Unable to retrieve user token balance for ${name}`,
          err
        );
      }

      return walletBalance;
    }, {})
  }

  // => { [token]: rate }
  async get1inchSwapRates () {
    const batchedPromises = Object
      .entries(this.TOKEN_CALL_DATA)
      .map(([key, value]) => fetchRate1Inch(...Object.values(value)))

    const rates1inch = await Promise.all(batchedPromises);

    return rates1Inch.reduce((rates, res) => {
      const symbol = res.fromToken.symbol;
      const formatSymbol = symbol === 'KOGECOIN' ? 'KOGE' : symbol;
      const rate = res.toTokenAmount;

      // rates[formatSymbol] = web3.utils.fromWei(rate, 'ether');
      rates[formatSymbol] = rate;
      return rates;
    }, {});
  }

  // => { [token]: rate }
  async getDEXSwapRates (DEX) {
    const batchedPromises = Object
      .entries(TOKEN_CALL_DATA)
      .map(([key, value]) =>  {
        const {
          amount: amountIn,
          fromTokenAddress: reserveIn,
          toTokenAddress: reserveOut
        } = this.TOKEN_CALL_DATA[key];
        return fetchRateDEX(DEX, this.CONTRACTS[DEX], amountIn, reserveIn, reserveOut);
      });

    const ratesDEX = await Promise.all(batchedPromises);
    const tokens = Object.keys(this.TOKEN_CALL_DATA);

    return ratesDEX.reduce((rates, rate, idx) => {
      rates[tokens[idx]] = rate;
      return rates;
    }, {});
  }

  async populateTokenSwapRates () {
    try {
      this.TOKEN_SWAP_RATES['1inch'] = await get1inchswapRates();
      this.TOKEN_SWAP_RATES['Cafeswap'] = await getDEXSwapRates('CAFESWAP');
      this.TOKEN_SWAP_RATES['ApeSwap'] = await getDEXSwapRates('APESWAP');
    } catch(err) {
      console.error(
        `Unable to populate token rates`,
        err
      );
    };
  }

  computeMaxWalletValue () {
    // for each token balance, for each exchange, get the max rate, store max values
    return Object
      .entries(this.WALLET_BALANCE)
      .reduce(
        (maxWalletValue, balanceEntry) => {
          const [token, balance] = balanceEntry;
          const maxRate = Object
            .values(this.TOKEN_SWAP_RATES)
            .reduce((maxRate, rates) => {
              const convTokenRate = this.BigNumber.from(rates[token]);
              return maxRate.gt(convTokenRate) ? maxRate : convTokenRate;
            }, this.BigNumber.from(0));

          // add total value of current token at max rate to running wallet total
          return maxWalletValue.add(maxRate.mul(balance));
        }, this.BigNumber.from(0));
  }

  async run () {
    // populate token swap rates
    await populateTokenSwapRates();

    // return max wallet value result
    this.RESULT = computeMaxWalletValue();
  }

}

const AssignmentOne = new Assignment();
AssignmentOne.initialize();
AssignmentOne.run();

Assignment.RESULT;
