const puppeteer = require('puppeteer')
const fs = require('fs');
const json = require('./inputs.json');
require('dotenv').config();
const {setIntervalAsync} = require("set-interval-async/dynamic");

process.on('unhandledRejection', console.log.bind(console));

/**
 * Define constants
 */
const { QUORA_EMAIL, QUORA_PASSWORD } = process.env;
const ROOT = 'https://www.quora.com/';

const main = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: ['--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    page.on('console', consoleObj => console.log(consoleObj.text()));

    await page.goto(`${ROOT}?prevent_redirect=1s`, {
      waitUntil: "domcontentloaded"
    });

    await sleep(340);
    //await page.type('input.header_login_text_box[name="email"]', CREDS.username);

    await page.keyboard.type(QUORA_EMAIL);
    await sleep(150);
    await page.keyboard.press('Tab', {
      delay: (Math.random() + 0.5) * 400
    });

    await sleep(500);
    await page.keyboard.type(QUORA_PASSWORD);
    await page.keyboard.press('Tab', {
      delay: (Math.random() + 0.5) * 400
    });

    await sleep(500);
    await page.keyboard.press('Enter', {
      delay: (Math.random() + 0.5) * 400
    });

    // Workaround the click as the input doesn't work
    //await page.focus('input.submit_button[type="submit"]');
    //await page.keyboard.type("\n");

    await page.goto(`${ROOT}profile/Samarpit-Arya-3/answers`, {
      waitUntil: 'load'
    });

    await page.waitFor(5000);

    await page.reload({
        'waitUntil': 'load'
    });

    await page.waitFor(5000);

    await autoScroll(page);

    try {
        const items = await page.$$(
          '.feed_item > div:not(.hidden) .icon_action_bar a[action_click="AnswerUpvote"]'
        );

        if (items.length === 0)
            return {
              type: 'success',
              message: `No upvote to do`
            };

        console.log(`Found: ${items.length} items to upvote`);
    } catch (error) {
        console.error(error);
        return `No item to scroll found`
    }

    let counter = 0;

    for (let index = 0; index < items.length; index++) {
        try {
            let item = items[index];
            if (!item) continue;
            await page.evaluate(item => item.click(), item);
            counter++;
        } catch (error) {
            console.error(error);
            items.splice(index, 1);
        }
    }

    console.log(`Upvoted ${counter}`)

    return {
        type: 'success',
        message: `Successfully upvoted ${counter}`,
        data: items
    };
}

/**
 * Autoscroll to the bottom of a page
 *
 * @param {*} page
 */
const autoScroll = async(page) => {
    await page.exposeFunction('setIntervalAsync', setIntervalAsync);
    await page.exposeFunction('sleep', sleep);
    await page.evaluate(async () =>
        await new Promise(async (resolve, reject) => {
            let totalHeight = 0;
            let distance = 500;
            let scrollHeight = document.body.scrollHeight;

            try {
                const repeater = async () => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    await window.sleep(2000);

                    scrollHeight = document.body.scrollHeight;

                    console.log("total: " + totalHeight);
                    console.log("height: " + scrollHeight);

                    if (totalHeight >= scrollHeight) resolve();
                    else repeater();
                }
                repeater();
            } catch (error) {
                reject(error);
            }

        }).catch(e => console.error(e))
    )
    console.log("Done scrolling");
};

/**
 * Sleep or delay a function for a defined amount of time
 * @param {number} time
 */
const sleep = time => new Promise( resolve => setTimeout(resolve, time));


main().then(value => {
        const data = JSON.stringify(value, null, 2)
        console.log(value);
        console.log(data);
        // Store in a file
        /* fs.writeFile('results.json', data, (err) => {
            if (err) throw err;
            console.log('Data written to file');
        }); */
    })
    .catch(e => console.log(`error: ${e}`))