const Apify = require('apify');
const request = require('request');
const Promise = require('bluebird');
const _ = require('lodash');

function requestPromise(url, options) {
  return new Promise((resolve,reject) => {
    request(url, options, (err, response, body) => {
      if (err) return reject(err);
      if (response.statusCode !== 200) return reject(new Error('Invalid status code'));
      return resolve(body);
    })
  });
}

const randomDelay = delay => new Promise((resolve) => {
    setTimeout(resolve, _.random(0, delay));
});

async function getIpLocation(proxyUrl){
    try {
        const start = Date.now();
        const html = await requestPromise('https://www.iplocation.net/', { proxy: proxyUrl });
        const duration = Date.now() - start;
        let match = html.match(/\/assets\/images\/flags\/([^.]+)\.gif/);
        let location = null;
        if (match && match.length > 0 && match[1]){
            location = match[1].toLowerCase();
        }
        let ip = null;
        match = html.match(/<td>(\d+\.\d+\.\d+\.\d+)<\/td>/);
        if (match && match.length > 0 && match[1]){
            ip = match[1].toLowerCase();
        }
        return { ip, location, duration };
    }catch(e){
        console.error(e.message);
        throw e;
    }
}

async function raceIpLocation(proxyUrl) {
    return Promise.race([
        getIpLocation(proxyUrl),
        new Promise((resolve, reject) => setTimeout(reject('Took too long'), 15000)),
    ]);
}

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');
    await Promise.map(input, (proxyUrl) => {
        const range = _.range(2000);
        return Promise.map(range, async () => {
            try {
                await randomDelay(10000);
                const response = await getIpLocation(proxyUrl);
                if (!response) throw new Error('Page could not be opened');
                await Apify.pushData({ proxyUrl, ...response });
            } catch (error) {
                await Apify.pushData({ proxyUrl, error: error.message });
            }
        }, { concurrency: 100 });
    }, { concurrency: 2 });
});