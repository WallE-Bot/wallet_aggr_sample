const { API_1inch } = require('constants');

const helpers = {

  fetchRate1inch: async (fromAddress, toAddress, amount) => {
    const URL = `${API_1inch}fromTokenAddress=${fromAddress}&toTokenAddress=${toAddress}&amount=${amount}`;
    const res = await fetch(URL);
    const result = res.json();

    return result;
  },

  fetchRateDEX: async (DEX, CONTRACT, amountIn, reserveIn, reserveOut) => {
    let res;
    try {
      res = CONTRACT.methods
        .getAmountOut(amountIn, reserveIn, reserveOut)
        .call((err, res) => {
          if (err) {
            throw new Error(`Error fetching swap rate from ${DEX}`);
          }
          return res;
        });
    } catch(err) {
      console.error(
        `Unable to fetch rate from ${DEX}`,
        err
      );
    };

    return res;
  }

}

module.exports = { helpers };
