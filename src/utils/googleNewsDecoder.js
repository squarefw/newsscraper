const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Google News URL Decoder (Node.js version)
 * Ported from googlenewsdecoder (Python) logic
 */

class GoogleNewsDecoder {
  constructor() {
    this.batchExecuteUrl = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
    this.userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Decode a list of Google News URLs
   * @param {string[]} sourceUrls 
   * @returns {Promise<Object[]>}
   */
  async decodeBatch(sourceUrls) {
    const results = [];
    for (let i = 0; i < sourceUrls.length; i++) {
      // Add small random delay between requests (0.5-1.5 seconds)
      if (i > 0) {
        const delay = 500 + Math.random() * 1000;
        await this.sleep(delay);
      }
      
      const res = await this.decodeSingle(sourceUrls[i]);
      results.push(res);
    }
    return results;
  }

  /**
   * Decode a single Google News URL
   */
  async decodeSingle(sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      const pathParts = url.pathname.split('/');
      let token = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
      
      if (token.includes('?')) {
        token = token.split('?')[0];
      }

      if (!(url.hostname === "news.google.com" && pathParts.length > 1 && (pathParts[pathParts.length-2] === "articles" || pathParts[pathParts.length-2] === "read"))) {
        return { status: false, error: "Invalid Google News URL", original: sourceUrl };
      }

      // --- Fast Path: Offline Decoding ---
      try {
        const decodedBytes = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        const decodedStr = decodedBytes.toString('latin1');
        
        // Google News URL prefix: \x08\x13\x22
        const prefix = Buffer.from([0x08, 0x13, 0x22]).toString('latin1');
        if (decodedStr.startsWith(prefix)) {
            let tempStr = decodedStr.substring(prefix.length);
            
            // Suffix: \xd2\x01\x00
            const suffix = Buffer.from([0xD2, 0x01, 0x00]).toString('latin1');
            if (tempStr.includes(suffix)) {
                tempStr = tempStr.split(suffix)[0];
            }
            
            const bytesArray = Buffer.from(tempStr, 'latin1');
            const length = bytesArray[0];
            let urlPart;
            if (length >= 0x80) {
                urlPart = tempStr.substring(2, length + 1);
            } else {
                urlPart = tempStr.substring(1, length + 1);
            }
            
            if (urlPart && urlPart.startsWith('http')) {
                return { status: true, url: urlPart, method: 'offline' };
            }
            
            // If it starts with AU_yqL, it's definitely a dynamic link requiring network
            if (urlPart && urlPart.startsWith('AU_yqL')) {
                // Continue to network phase
            } else if (urlPart && (urlPart.includes('http') || urlPart.includes('www.'))) {
                // Secondary check for embedded URLs
                const match = urlPart.match(/https?:\/\/[^\s]+/);
                if (match) return { status: true, url: match[0], method: 'offline_parsed' };
            }
        }
      } catch (e) {
        console.warn(`   ⚠️ Offline decoding failed, falling back to network...`);
      }

      // --- Network Path: Exchange token for URL ---
      // Node.js HTTP/TLS stack is strictly fingerprinted and blocked by Google News (429).
      // However, the python `googlenewsdecoder` library uses `urllib3` which bypasses this.
      // We will bridge to the Python environment to securely fetch the URL without blocking.
      return await this.decodeViaPython(sourceUrl);
    } catch (e) {
      return { status: false, error: e.message, original: sourceUrl };
    }
  }

  /**
   * Shells out to Python's googlenewsdecoder library which has a pristine TLS fingerprint
   * and can successfully retrieve the signature and decode the URL without 429 errors.
   */
  async decodeViaPython(url) {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const script = `
import sys, json
try:
    import googlenewsdecoder
    res = googlenewsdecoder.gnewsdecoder('${url}')
    if isinstance(res, dict):
        print(json.dumps({"status": res.get("status", False), "url": res.get("decoded_url")}))
    else:
        print(json.dumps({"status": True, "url": res}))
except Exception as e:
    print(json.dumps({"status": False, "error": str(e)}))
`;
      
      const b64 = Buffer.from(script).toString('base64');
      const cmd = `export PYTHONPATH=$PYTHONPATH:/opt/homebrew/lib/python3.9/site-packages && echo "${b64}" | base64 -d | /opt/homebrew/bin/python3.9`;
      
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {

        if (error) {
          resolve({ status: false, error: "Python execution failed: " + (error.message || stderr) });
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.status && parsed.url) {
            resolve({ status: true, url: parsed.url, method: 'hybrid_python' });
          } else {
            resolve({ status: false, error: parsed.error || "Unknown python decode error" });
          }
        } catch (parseError) {
          resolve({ status: false, error: "Failed to parse Python output: " + stdout });
        }
      });
    });
  }
}

module.exports = GoogleNewsDecoder;
