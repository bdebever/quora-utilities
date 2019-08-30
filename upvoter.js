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
const TODAY = new Date();
const STAMP = TODAY.getTime();

/**
 * Main function
 *
 * TODO:
 * 1. Check for duplicate in the json
 * 2. Handle login -> bind profiles to a user logging in
 * 3. Give more stats: total answers, total to upvotes, unable to upvotes, etc. (compare stats left and number divs)
 * 4. Detect last date scroll -> don't go past that
 */
const main = async () => {
    const browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      ignoreHTTPSErrors: true,
      //args: ['--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    page.on('console', consoleObj => console.log(consoleObj.text()));

    await page.goto(`${ROOT}?prevent_redirect=1s`, {
      waitUntil: "domcontentloaded"
    });

    await sleep(340);
    //await page.type('input.header_login_text_box[name="email"]', CREDS.username);

    // TODO: standardize this in a separate module (the login/pwd part)
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

    const profiles = extract();
    if (profiles.length === 0)
        return {
            type: 'error',
            message: 'No profile found'
        };

    const results = [];
    let total_counter = 0;

    for (let i = profiles.length-1; i >= 0; i--) {
        const profile = profiles[i];

        await page.goto(`${ROOT}profile/${profile}/answers`, {waitUntil: 'load'});

        console.log(`Starting scrolling for ${profile}`);

        await page.waitFor(5000);

        if (page.url() !== `${ROOT}profile/${profile}/answers`)
            return {
              type: "error",
              message: "Error hitting page"
            };

        await page.reload({
            'waitUntil': 'load'
        });

        await page.waitFor(5000);

        await autoScroll(page, i, 100000);

        let items = [];

        try {
            items = await page.$$(
                '.feed_item > div:not(.hidden) .icon_action_bar a[action_click="AnswerUpvote"]'
            );

            if (items.length === 0) {
                results.push({ profile, type: "error" });
                console.log("Nothing to upvote on this profile was found");
                continue;
            }

        } catch (error) {
            console.error(error);
            return `No item to scroll found`;
        }

        let counter_profile = 0;

        console.log(`Found: ${items.length} items to upvote for ${profile}`);

        for (let index = 0; index < items.length; index++) {
            try {
                const item = items[index];
                if (!item) continue;
                await page.evaluate(item => item.click(), item);
                counter_profile++;
                sleep((Math.random()+Math.random()+0.5) * 5000)
            } catch (error) {
                console.error(error);
                items.splice(index, 1);
            }
        }

        console.log(`Upvoted ${counter_profile} for ${profile}`)
        total_counter += counter_profile;

        results.push({
          profile,
          upvotes: counter_profile,
          latest_upvote: TODAY,
          type: 'success'
        });

        sleep(Math.random * 10000)
    }

    return {
        type: 'success',
        date: TODAY,
        message: `Successfully upvoted ${total_counter} posts on ${profiles.length} profiles`,
        results
    };
}

/**
 * Extract profiles (QuoraID) from links
 *
 * @returns {Array}
 */
const extract = () => {
    console.log(`${json.length} profiles found`);
    const profiles = [];
    for (const link of json) {
        const string = link.substring(link.indexOf('profile') + 8);
        if (string && string.length > 0) profiles.push(string);
    }
    return profiles;
}

/**
 * Autoscroll to the bottom of a page
 *
 * @param {*} page
 * @param {number} loop
 * @param {number} stopper
 */
const autoScroll = async(page, loop = 0, stopper = 0) => {

    // TODO: find another way to deal with that
    if (loop === 0) {
        await page.exposeFunction('sleep', sleep);
        await page.exposeFunction('setIntervalAsync', setIntervalAsync);
    }

    try {
        await page.evaluate(async () =>
            await new Promise(async (resolve, reject) => {
                let totalHeight = 0;
                let distance = 500;
                let scrollHeight = document.body.scrollHeight;

                try {
                    const repeater = async () => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        await new Promise( resolve => window.setTimeout(resolve, 1200));

                        // For Quora: temporary solution
                        // Check if we have an upvoted item=>s don't go further
                        const upvotedItems = [...document.querySelectorAll(
                          '.feed_item > div:not(.hidden) .icon_action_bar a[action_click="AnswerRemoveUpvote"]'
                        )];

                        if (upvotedItems.length > 0 && totalHeight > 2000) resolve();

                        console.log('Scroll Height: ' + scrollHeight);
                        console.log('Total Height: ' + totalHeight);

                        scrollHeight = document.body.scrollHeight;

                        if (totalHeight >= scrollHeight || scrollHeight >= 50000) resolve();
                        else repeater();
                    }
                    repeater();
                } catch (error) {
                    reject(error);
                }

            }).catch(e => console.error(e))
        , stopper)
    } catch (error) {

    }

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
        // Store in a file
        return fs.writeFile(`./results/${STAMP}_logs.json`, data, (err) => {
            if (err) throw err;
            console.log('Data written to file');
        });
    })
    .catch(e => console.log(`error: ${e}`))