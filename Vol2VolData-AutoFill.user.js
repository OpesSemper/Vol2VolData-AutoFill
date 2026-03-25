// ==UserScript==
// @name         Vol2VolData AutoFill
// @namespace    https://github.com/pageth
// @version      1.0
// @description  Auto fill Intraday & OI Data
// @author       filmworachai
// @match        https://*.tradingview.com/chart/*
// @icon         https://raw.githubusercontent.com/OpesSemper/Vol2VolData-AutoFill/refs/heads/main/tradingview.ico
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @downloadURL  https://raw.githubusercontent.com/OpesSemper/Vol2VolData-AutoFill/main/Vol2VolData-AutoFill.user.js
// @updateURL    https://raw.githubusercontent.com/OpesSemper/Vol2VolData-AutoFill/main/Vol2VolData-AutoFill.user.js
// ==/UserScript==

(function () {
"use strict";


const OWNER = "pageth";
const REPO  = "Vol2VolData";
const BRANCH = "main";

let latestSHA = BRANCH;
let etagCommit = null;
let lastPopup = null;

function fetchURL(url) {
    
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: r => {
                if (r.status === 200){
                    console.log("Fetch data from", url, "successful")
                }
                
                resolve(r.status === 200 ? r.responseText : null)
            },
            onerror: () => resolve(null)
        });
    });
}

async function buildRawURLs(sha) {
    return {
        intraday: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/IntradayData.txt`,
        oi:       `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/OIData.txt`
    };
}
    
async function fetchAll(commitSHA) {
    const urls = await buildRawURLs(commitSHA)
    const [intraday, oi] = await Promise.all([
        //const URL_INTRADAY = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${latestSHA}/IntradayData.txt`;
        //const URL_OI       = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${latestSHA}/OIData.txt`;
    
        fetchURL(urls.intraday),
        fetchURL(urls.oi)
    ]);
    return { intraday, oi };
}

function fetchLatestSHA() {
    return new Promise(resolve => {
        const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`;

        GM_xmlhttpRequest({
            method: "GET",
            url,
            headers: {
                ...(etagCommit && { "If-None-Match": etagCommit }),
                "Accept": "application/vnd.github+json"
            },
            onload: r => {
                if (r.status === 304) {
                    return resolve({ status: "NOT_MODIFIED" });
                }

                if (r.status !== 200) {
                    return resolve({ status: "ERROR" });
                }

                const match = r.responseHeaders.match(/etag:\s*(.*)/i);
                if (match) etagCommit = match[1];

                const data = JSON.parse(r.responseText);
                
                resolve({
                    status: "OK",
                    sha: data.sha
                });
            },
            onerror: () => resolve({ status: "ERROR" })
        });
    });
}

function fillReact(el, data) {
    if (!el || !data) return;

    const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
    ).set;

    setter.call(el, data);

    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setColor(el, color) {
    if (!el) return;
    el.style.transition = "background 0.2s";
    el.style.background = color;
}

function findTextareas() {

    const labels = [...document.querySelectorAll("div,span")];
    const textareas = [...document.querySelectorAll("textarea")];

    let taIntraday = null;
    let taOI = null;

    const labelIntraday = labels.find(e => {
        const t = e.textContent.trim().toUpperCase();
        return t === "INTRADAY DATA" || t === "INTRADAY VOLUME CSV";
    });

    const labelOI = labels.find(e => {
        const t = e.textContent.trim().toUpperCase();
        return t === "OI DATA" || t === "OI DATA CSV";
    });

    if (labelIntraday) {
        taIntraday = textareas.find(t =>
            labelIntraday.compareDocumentPosition(t) &
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    }

    if (labelOI) {
        taOI = textareas.find(t =>
            labelOI.compareDocumentPosition(t) &
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    }

    return { taIntraday, taOI };
}

async function runAutofill() {

    const { taIntraday, taOI } = findTextareas();
    if (!taIntraday && !taOI) return;

    const popup = taIntraday?.closest('[role="dialog"]')
        || taOI?.closest('[role="dialog"]');

    // fetch last SHA
    
    const res = await fetchLatestSHA();

    if (res.status === "NOT_MODIFIED") {
        return; // ไม่มี commit ใหม่
    }

    if (res.status !== "OK") {
        console.log("Commit fetch error");
        return;
    }

    if (!popup || popup === lastPopup || latestSHA === res.sha) return;
    
    latestSHA = res.sha;
    console.log("🚀 New SHA:", res.sha);

    lastPopup = popup;

    console.log("Autofill");

    setColor(taIntraday, "#6b6b00");
    setColor(taOI, "#6b6b00");

    const data = await fetchAll(res.sha);

    if (taIntraday) {
        if (data.intraday) {
            fillReact(taIntraday, data.intraday);
            setColor(taIntraday, "#006400");
            console.log("Intraday OK");
        } else {
            setColor(taIntraday, "#8B0000");
            console.log("Intraday FAIL");
        }
        setTimeout(() => taIntraday.style.background = "", 2000);
    }

    if (taOI) {
        if (data.oi) {
            fillReact(taOI, data.oi);
            setColor(taOI, "#006400");
            console.log("OI OK");
        } else {
            setColor(taOI, "#8B0000");
            console.log("OI FAIL");
        }
        setTimeout(() => taOI.style.background = "", 2000);
    }
}

const observer = new MutationObserver(() => runAutofill());

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Vol2Vol AutoFill loaded");

})();
