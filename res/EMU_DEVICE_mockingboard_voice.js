/*
MIT License

Copyright (c) 2024-2026 Robert Elmer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


JavaScript port of relmer/Casso Ssi263.cpp and Ssi263.h
Upstream commit: c9c2964ee3b777f06718d88bd3132e4225ee70e3
Source: https://github.com/relmer/Casso
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.SSI263 = api.SSI263; root.SSI263Tools = api; }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const f = Math.fround;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const add = (a,b) => f(a+b), sub = (a,b) => f(a-b), mul = (a,b) => f(a*b);
  const PHONEMES = [
  {
    "f1": 0,
    "f2": 0,
    "f3": 0,
    "voiced": false,
    "fricative": false,
    "voicedLevel": 0.0,
    "fricLevel": 0.0,
    "code": 0,
    "name": "PA",
    "example": "(pause)"
  },
  {
    "f1": 314,
    "f2": 2330,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.8,
    "fricLevel": 0.0,
    "code": 1,
    "name": "E",
    "example": "meet"
  },
  {
    "f1": 446,
    "f2": 2330,
    "f3": 2677,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 2,
    "name": "E1",
    "example": "bent"
  },
  {
    "f1": 256,
    "f2": 2257,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.73,
    "fricLevel": 0.0,
    "code": 3,
    "name": "Y",
    "example": "before"
  },
  {
    "f1": 314,
    "f2": 2174,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 4,
    "name": "YI",
    "example": "year"
  },
  {
    "f1": 365,
    "f2": 2330,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.8,
    "fricLevel": 0.0,
    "code": 5,
    "name": "AY",
    "example": "please"
  },
  {
    "f1": 256,
    "f2": 2408,
    "f3": 2832,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.6,
    "fricLevel": 0.0,
    "code": 6,
    "name": "IE",
    "example": "any"
  },
  {
    "f1": 446,
    "f2": 2007,
    "f3": 2598,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 7,
    "name": "I",
    "example": "six"
  },
  {
    "f1": 482,
    "f2": 2096,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 8,
    "name": "A",
    "example": "made"
  },
  {
    "f1": 482,
    "f2": 1922,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 9,
    "name": "AI",
    "example": "care"
  },
  {
    "f1": 577,
    "f2": 1823,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 10,
    "name": "EH",
    "example": "nest"
  },
  {
    "f1": 605,
    "f2": 1922,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 11,
    "name": "EH1",
    "example": "belt"
  },
  {
    "f1": 683,
    "f2": 1922,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 12,
    "name": "AE",
    "example": "dad"
  },
  {
    "f1": 731,
    "f2": 1730,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 13,
    "name": "AE1",
    "example": "after"
  },
  {
    "f1": 731,
    "f2": 1261,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 14,
    "name": "AH",
    "example": "got"
  },
  {
    "f1": 731,
    "f2": 1387,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.47,
    "fricLevel": 0.0,
    "code": 15,
    "name": "AH1",
    "example": "father"
  },
  {
    "f1": 683,
    "f2": 1106,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 16,
    "name": "AW",
    "example": "office"
  },
  {
    "f1": 516,
    "f2": 943,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 17,
    "name": "O",
    "example": "store"
  },
  {
    "f1": 446,
    "f2": 943,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.6,
    "fricLevel": 0.0,
    "code": 18,
    "name": "OU",
    "example": "boat"
  },
  {
    "f1": 546,
    "f2": 1106,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 19,
    "name": "OO",
    "example": "look"
  },
  {
    "f1": 365,
    "f2": 1620,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 20,
    "name": "IU",
    "example": "you"
  },
  {
    "f1": 406,
    "f2": 1387,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.6,
    "fricLevel": 0.0,
    "code": 21,
    "name": "IU1",
    "example": "could"
  },
  {
    "f1": 365,
    "f2": 943,
    "f3": 2244,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 22,
    "name": "U",
    "example": "tune"
  },
  {
    "f1": 256,
    "f2": 722,
    "f3": 2142,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 23,
    "name": "U1",
    "example": "cartoon"
  },
  {
    "f1": 546,
    "f2": 1387,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 24,
    "name": "UH",
    "example": "wonder"
  },
  {
    "f1": 605,
    "f2": 1261,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 25,
    "name": "UH1",
    "example": "love"
  },
  {
    "f1": 657,
    "f2": 1261,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 26,
    "name": "UH2",
    "example": "what"
  },
  {
    "f1": 657,
    "f2": 1514,
    "f3": 2511,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.47,
    "fricLevel": 0.0,
    "code": 27,
    "name": "UH3",
    "example": "nut"
  },
  {
    "f1": 482,
    "f2": 1387,
    "f3": 1696,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 28,
    "name": "ER",
    "example": "bird"
  },
  {
    "f1": 365,
    "f2": 943,
    "f3": 1424,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 29,
    "name": "R",
    "example": "roof"
  },
  {
    "f1": 314,
    "f2": 1261,
    "f3": 1822,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 30,
    "name": "R1",
    "example": "rug"
  },
  {
    "f1": 516,
    "f2": 1620,
    "f3": 2336,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 31,
    "name": "R2",
    "example": "mutter"
  },
  {
    "f1": 365,
    "f2": 1261,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.47,
    "fricLevel": 0.0,
    "code": 32,
    "name": "L",
    "example": "lift"
  },
  {
    "f1": 256,
    "f2": 1514,
    "f3": 2832,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 33,
    "name": "L1",
    "example": "play"
  },
  {
    "f1": 446,
    "f2": 943,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.6,
    "fricLevel": 0.0,
    "code": 34,
    "name": "LF",
    "example": "fall"
  },
  {
    "f1": 365,
    "f2": 722,
    "f3": 2336,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 35,
    "name": "W",
    "example": "water"
  },
  {
    "f1": 256,
    "f2": 1261,
    "f3": 2598,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 36,
    "name": "B",
    "example": "bag"
  },
  {
    "f1": 256,
    "f2": 1922,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 37,
    "name": "D",
    "example": "paid"
  },
  {
    "f1": 365,
    "f2": 2007,
    "f3": 2244,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 38,
    "name": "KV",
    "example": "tag"
  },
  {
    "f1": 406,
    "f2": 1106,
    "f3": 2244,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 1.0,
    "code": 39,
    "name": "P",
    "example": "pen"
  },
  {
    "f1": 406,
    "f2": 1922,
    "f3": 2756,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 1.0,
    "code": 40,
    "name": "T",
    "example": "tart"
  },
  {
    "f1": 365,
    "f2": 2007,
    "f3": 2244,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 0.27,
    "code": 41,
    "name": "K",
    "example": "kit"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2598,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 42,
    "name": "HV",
    "example": "(hold vocal)"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2598,
    "voiced": false,
    "fricative": false,
    "voicedLevel": 0.0,
    "fricLevel": 0.0,
    "code": 43,
    "name": "HVC",
    "example": "(hold vocal closure)"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2598,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 0.53,
    "code": 44,
    "name": "HF",
    "example": "heart"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2598,
    "voiced": false,
    "fricative": false,
    "voicedLevel": 0.0,
    "fricLevel": 0.0,
    "code": 45,
    "name": "HFC",
    "example": "(hold fric closure)"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2598,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.27,
    "fricLevel": 0.0,
    "code": 46,
    "name": "HN",
    "example": "(hold nasal)"
  },
  {
    "f1": 365,
    "f2": 1106,
    "f3": 2677,
    "voiced": true,
    "fricative": true,
    "voicedLevel": 0.07,
    "fricLevel": 0.67,
    "code": 47,
    "name": "Z",
    "example": "zero"
  },
  {
    "f1": 176,
    "f2": 1730,
    "f3": 2598,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 1.0,
    "code": 48,
    "name": "S",
    "example": "same"
  },
  {
    "f1": 314,
    "f2": 2096,
    "f3": 2756,
    "voiced": true,
    "fricative": true,
    "voicedLevel": 0.07,
    "fricLevel": 0.67,
    "code": 49,
    "name": "J",
    "example": "measure"
  },
  {
    "f1": 314,
    "f2": 2096,
    "f3": 2756,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 0.4,
    "code": 50,
    "name": "SCH",
    "example": "ship"
  },
  {
    "f1": 314,
    "f2": 1261,
    "f3": 2336,
    "voiced": true,
    "fricative": true,
    "voicedLevel": 0.2,
    "fricLevel": 0.27,
    "code": 51,
    "name": "V",
    "example": "very"
  },
  {
    "f1": 314,
    "f2": 1261,
    "f3": 2336,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 0.27,
    "code": 52,
    "name": "F",
    "example": "four"
  },
  {
    "f1": 365,
    "f2": 1730,
    "f3": 2756,
    "voiced": true,
    "fricative": true,
    "voicedLevel": 0.07,
    "fricLevel": 0.13,
    "code": 53,
    "name": "THV",
    "example": "there"
  },
  {
    "f1": 446,
    "f2": 1823,
    "f3": 2425,
    "voiced": false,
    "fricative": true,
    "voicedLevel": 0.0,
    "fricLevel": 0.13,
    "code": 54,
    "name": "TH",
    "example": "with"
  },
  {
    "f1": 176,
    "f2": 1261,
    "f3": 2336,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 55,
    "name": "M",
    "example": "more"
  },
  {
    "f1": 176,
    "f2": 1823,
    "f3": 2677,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 56,
    "name": "N",
    "example": "nine"
  },
  {
    "f1": 314,
    "f2": 2174,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.27,
    "fricLevel": 0.0,
    "code": 57,
    "name": "NG",
    "example": "rang"
  },
  {
    "f1": 516,
    "f2": 1922,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 58,
    "name": ":A",
    "example": "maerchen"
  },
  {
    "f1": 314,
    "f2": 1823,
    "f3": 2336,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.4,
    "fricLevel": 0.0,
    "code": 59,
    "name": ":OH",
    "example": "loewe"
  },
  {
    "f1": 256,
    "f2": 1730,
    "f3": 2336,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 60,
    "name": ":U",
    "example": "fuenf"
  },
  {
    "f1": 176,
    "f2": 1922,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.67,
    "fricLevel": 0.0,
    "code": 61,
    "name": ":UH",
    "example": "menu"
  },
  {
    "f1": 482,
    "f2": 1730,
    "f3": 2425,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.47,
    "fricLevel": 0.0,
    "code": 62,
    "name": "E2",
    "example": "bitte"
  },
  {
    "f1": 256,
    "f2": 943,
    "f3": 2756,
    "voiced": true,
    "fricative": false,
    "voicedLevel": 0.53,
    "fricLevel": 0.0,
    "code": 63,
    "name": "LB",
    "example": "lube"
  }
];
  PHONEMES.forEach(p => { p.voicedLevel=f(p.voicedLevel); p.fricLevel=f(p.fricLevel); Object.freeze(p); });
  Object.freeze(PHONEMES);
  function requireInteger(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(label + " must be an integer from " + min + " to " + max);
    }
    return value;
  }
  function requirePositive(value, label) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + " must be positive and finite");
    return value;
  }
  class SSI263 {
    constructor(xckHz = 1789772.5) {
      this.m_xckHz = requirePositive(xckHz, "XCK");
      this.m_tickClockHz = 0;
      this.m_sampleRate = 0;
      this.m_sourcePole = f(0.0065);
      this.m_formants = null;
      this.m_reg = new Uint8Array(5);
      this.m_fCur = new Float64Array(3);
      this.m_resY1 = new Float32Array(3);
      this.m_resY2 = new Float32Array(3);
      this.Reset();
    }
    SetSampleRate(sampleRate) {
      this.m_sampleRate = requireInteger(sampleRate, 0, 384000, "Sample rate");
      if (sampleRate > 0) this.m_sourcePole = f(1 - Math.exp(-2 * Math.PI * 50 / sampleRate));
    }
    SetXckClock(xckHz) {
      const previousXck = this.m_xckHz, previousTick = this.GetTickClockHz();
      this.m_xckHz = requirePositive(xckHz, "XCK");
      this.m_phonemeCycles *= (previousXck / this.m_xckHz) * (this.GetTickClockHz() / previousTick);
    }
    SetTickClock(tickClockHz) {
      const previous = this.GetTickClockHz();
      this.m_tickClockHz = requirePositive(tickClockHz, "Tick clock");
      this.m_phonemeCycles *= this.m_tickClockHz / previous;
    }
    static SelectRegister(address) { return Math.min(address & 7, 4); }
    WriteRegister(reg, value) {
      requireInteger(reg, 0, 255, "Register address");
      requireInteger(value, 0, 255, "Register value");
      const sel = SSI263.SelectRegister(reg), wasDown = this.IsPoweredDown();
      this.m_reg[sel] = value;
      if (sel === 3) {
        if (wasDown && !this.IsPoweredDown()) this.LatchMode();
        else if (!wasDown && this.IsPoweredDown()) {
          this.m_sounding = false; this.m_phonemeCycles = 0; this.m_request = false;
        }
      } else if (sel === 0 && !this.IsPoweredDown()) this.BeginPhoneme();
    }
    Reset() {
      this.m_reg.fill(0); this.m_reg[3] = 0x80;
      this.m_mode = 0; this.m_request = false; this.m_phonemeCycles = 0; this.m_sounding = false;
      this.m_fCur.fill(0); this.m_resY1.fill(0); this.m_resY2.fill(0);
      for (const key of ["envLevel", "radPrev", "outLp", "outLp2", "glottalPhase",
        "excLp1", "excLp2", "noiseLp", "vaCur", "faCur", "fricLp", "fricLp2", "fricLp3", "fricY1", "fricY2"]) {
        this["m_" + key] = 0;
      }
      this.m_lfsr = 0xACE1;
    }
    Tick(cycles) {
      requireInteger(cycles, 0, 0xffffffff, "Tick cycles");
      if (!this.m_sounding || this.IsPoweredDown()) return;
      this.m_phonemeCycles -= cycles;
      if (this.m_phonemeCycles <= 0) {
        this.m_phonemeCycles = 0; this.m_sounding = false;
        if (this.m_mode !== 0) this.m_request = true;
      }
    }
    IsRequesting() { return this.m_request; }
    IsPoweredDown() { return (this.m_reg[3] & 0x80) !== 0; }
    IsSilent() {
      return (this.IsPoweredDown() || this.GetAmplitude() === 0 || !this.m_sounding) && this.m_envLevel < f(0.001);
    }
    // Added status seam: D7 is the logical request (the physical A/R pin is active-low).
    ReadStatus() { return this.m_request ? 0x80 : 0; }
    ReadRegister() { return this.ReadStatus(); }
    GetRegisters() { return new Uint8Array(this.m_reg); }
    GetPhoneme() { return this.m_reg[0] & 63; }
    GetDurationSel() { return this.m_reg[0] >>> 6; }
    GetRateSel() { return this.m_reg[2] >>> 4; }
    GetAmplitude() { return this.m_reg[3] & 15; }
    GetArticulation() { return (this.m_reg[3] & 0x70) >>> 4; }
    GetActiveMode() { return this.m_mode; }
    GetFormantCenter(stage) { return this.m_fCur[requireInteger(stage, 0, 2, "Formant stage")]; }
    GetTickClockHz() { return this.m_tickClockHz > 0 ? this.m_tickClockHz : this.m_xckHz; }
    GetInflectionValue() { return ((this.m_reg[2] & 8) ? 0x800 : 0) | (this.m_reg[1] << 3) | (this.m_reg[2] & 7); }
    GetFrameDurationSec() { return 4096 * (16 - this.GetRateSel()) / this.m_xckHz; }
    GetPhonemeDurationSec() { return this.GetFrameDurationSec() * (this.m_mode === 1 ? 1 : 4 - this.GetDurationSel()); }
    GetFilterFrequencyHz() { return this.m_xckHz / (2 * (256 - this.m_reg[4])); }
    GetInflectionFrequencyHz() { return this.m_xckHz / (8 * (4096 - this.GetInflectionValue())); }
    SetFormantTable(table) {
      if (table === null) { this.m_formants = null; return; }
      if (!Array.isArray(table) || table.length !== 64) throw new RangeError("Formant table must contain 64 entries");
      this.m_formants = Array.from(table, (p, i) => {
        if (!p || typeof p !== "object") throw new TypeError("Missing acoustic entry for phoneme " + i);
        for (const k of ["f1", "f2", "f3"]) requireInteger(p[k], 0, 65535, "Phoneme " + i + " " + k);
        for (const k of ["voicedLevel", "fricLevel"]) {
          if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1) throw new RangeError(k + " must be from 0 to 1");
        }
        if (typeof p.voiced !== "boolean" || typeof p.fricative !== "boolean") throw new TypeError("Source flags must be booleans");
        return Object.freeze({...p, voicedLevel: f(p.voicedLevel), fricLevel: f(p.fricLevel)});
      });
    }
    GetActiveSpec() { return (this.m_formants || PHONEMES)[this.GetPhoneme()]; }
    static HasAnySource(spec) { return spec.voicedLevel > 0 || spec.fricLevel > 0; }
    LatchMode() {
      this.m_mode = this.GetDurationSel();
      if (this.m_mode === 0) {
        this.m_request = false; this.m_sounding = false; this.m_phonemeCycles = 0;
      } else this.BeginPhoneme();
    }
    BeginPhoneme() {
      this.m_phonemeCycles = this.GetPhonemeDurationSec() * this.GetTickClockHz();
      this.m_sounding = this.m_phonemeCycles > 0; this.m_request = false;
    }
    GlideFormants() {
      const spec = this.GetActiveSpec();
      if (spec.f1 === 0) return;
      const target = [spec.f1, spec.f2, spec.f3];
      if (this.m_fCur[0] <= 0) { this.m_fCur.set(target); return; }
      const tau = (8 - this.GetArticulation()) * 0.010;
      const coef = 1 - Math.exp(-1 / (tau * this.m_sampleRate));
      for (let i = 0; i < 3; i++) this.m_fCur[i] += coef * (target[i] - this.m_fCur[i]);
    }
    GlideLevels() {
      const spec = this.GetActiveSpec(), coef = f(1 - Math.exp(-1 / (0.0025 * this.m_sampleRate)));
      this.m_vaCur = add(this.m_vaCur, mul(coef, sub(spec.voicedLevel, this.m_vaCur)));
      this.m_faCur = add(this.m_faCur, mul(coef, sub(spec.fricLevel, this.m_faCur)));
    }
    GenerateExcitation() {
      const pitch = clamp(this.GetInflectionFrequencyHz(), 30, 400);
      this.m_glottalPhase += pitch / this.m_sampleRate;
      let impulse = 0;
      if (this.m_glottalPhase >= 1) { this.m_glottalPhase -= 1; impulse = 1; }
      this.m_excLp1 = add(this.m_excLp1, mul(this.m_sourcePole, sub(impulse, this.m_excLp1)));
      this.m_excLp2 = add(this.m_excLp2, mul(this.m_sourcePole, sub(this.m_excLp1, this.m_excLp2)));
      let src = mul(mul(this.m_excLp2, f(966)), this.m_vaCur);
      src = mul(src, f(731 / Math.max(this.m_fCur[0], 170)));
      return src;
    }
    GenerateNoiseSample() {
      const bit = this.m_lfsr & 1;
      this.m_lfsr >>>= 1;
      if (bit) this.m_lfsr ^= 0xB400;
      this.m_noiseLp = add(this.m_noiseLp, mul(f(0.07), sub(bit ? 1 : -1, this.m_noiseLp)));
      return this.m_noiseLp;
    }
    Resonate(stage, input, centerHz) {
      const fs = this.m_sampleRate, fc = clamp(centerHz, 50, fs * 0.45);
      const r = Math.exp(-Math.PI * [60, 90, 120][stage] / fs);
      const b = 2 * r * Math.cos(2 * Math.PI * fc / fs), c = -(r * r);
      const y = f((1 - b - c) * input + b * this.m_resY1[stage] + c * this.m_resY2[stage]);
      this.m_resY2[stage] = this.m_resY1[stage]; this.m_resY1[stage] = y;
      return y;
    }
    ResonateFricative(input, centerHz) {
      const fs = this.m_sampleRate, fc = clamp(centerHz, 50, fs * 0.45);
      const r = Math.exp(-Math.PI * 450 / fs);
      const b = 2 * r * Math.cos(2 * Math.PI * fc / fs), c = -(r * r);
      const y = f((1 - b - c) * input + b * this.m_fricY1 + c * this.m_fricY2);
      this.m_fricY2 = this.m_fricY1; this.m_fricY1 = y;
      return y;
    }
    GenerateSample() {
      if (this.IsSilent() || this.m_sampleRate === 0) return 0;
      this.GlideFormants(); this.GlideLevels();
      const scale = clamp(this.GetFilterFrequencyHz() / 20000, 0.5, 2);
      let sample = this.Resonate(0, this.GenerateExcitation(), this.m_fCur[0] * scale);
      for (let stage = 1; stage < 3; stage++) sample = this.Resonate(stage, sample, this.m_fCur[stage] * scale);
      if (this.GetActiveSpec().fricative || this.m_faCur > f(0.0001)) {
        const fric = this.ResonateFricative(this.GenerateNoiseSample(), this.m_fCur[1] * scale);
        this.m_fricLp = add(this.m_fricLp, mul(f(0.28), sub(fric, this.m_fricLp)));
        this.m_fricLp2 = add(this.m_fricLp2, mul(f(0.28), sub(this.m_fricLp, this.m_fricLp2)));
        this.m_fricLp3 = add(this.m_fricLp3, mul(f(0.28), sub(this.m_fricLp2, this.m_fricLp3)));
        sample = add(sample, mul(mul(this.m_fricLp3, f(0.165)), this.m_faCur));
      }
      const diffed = mul(sub(sample, this.m_radPrev), f(f(this.m_sampleRate) / f(44100)));
      this.m_radPrev = sample; sample = diffed;
      this.m_outLp = add(this.m_outLp, mul(f(0.32), sub(sample, this.m_outLp)));
      this.m_outLp2 = add(this.m_outLp2, mul(f(0.32), sub(this.m_outLp, this.m_outLp2)));
      sample = this.m_outLp2;
      const target = this.m_sounding ? mul(SSI263.HasAnySource(this.GetActiveSpec()) ? 1 : 0, f(this.GetAmplitude() / f(15))) : 0;
      const tau = target > this.m_envLevel ? 0.002 : 0.004;
      const coef = f(1 - Math.exp(-1 / (tau * this.m_sampleRate)));
      this.m_envLevel = add(this.m_envLevel, mul(coef, sub(target, this.m_envLevel)));
      sample = mul(sample, mul(this.m_envLevel, f(5)));
      return clamp(sample, -1, 1);
    }
  }
  SSI263.kRegCount = 5;
  SSI263.kAddressMask = 0x07;
  SSI263.kRegDurationPhoneme = 0;
  SSI263.kRegInflection = 1;
  SSI263.kRegRateInflection = 2;
  SSI263.kRegCtlArtAmp = 3;
  SSI263.kRegFilterFreq = 4;
  SSI263.kPhonemeMask = 0x3F;
  SSI263.kPhonemeCount = 64;
  SSI263.kDurationShift = 6;
  SSI263.kCtl = 0x80;
  SSI263.kArticMask = 0x70;
  SSI263.kArticShift = 4;
  SSI263.kAmplitudeMask = 0x0F;
  SSI263.kRateMask = 0xF0;
  SSI263.kRateShift = 4;
  SSI263.kInflect11 = 0x08;
  SSI263.kInflectLowMask = 0x07;
  SSI263.kModePhonemeTransitioned = 3;
  SSI263.kModePhonemeImmediate = 2;
  SSI263.kModeFrameImmediate = 1;
  SSI263.kModeArDisabled = 0;
  SSI263.kDefaultXckHz = 1789772.5;
  SSI263.kNominalFilterHz = 20000.0;
  SSI263.PHONEMES = PHONEMES;
  SSI263.VERSION = "0.1.0";
  SSI263.UPSTREAM_COMMIT = "c9c2964ee3b777f06718d88bd3132e4225ee70e3";
  const nameToCode = new Map(PHONEMES.map(p => [p.name, p.code]));
  function parseSequence(text) {
    if (typeof text !== "string") throw new TypeError("Enter a phoneme sequence");
    const tokens = text.trim().toUpperCase().split(/[\s,/]+/).filter(Boolean);
    if (!tokens.length || tokens.length > 4096) throw new RangeError("Enter 1 to 4096 phonemes");
    return tokens.map(token => {
      if (nameToCode.has(token)) return nameToCode.get(token);
      let code;
      if (/^\$[0-9A-F]{1,2}$/.test(token)) code = parseInt(token.slice(1), 16);
      else if (/^0X[0-9A-F]{1,2}$/.test(token)) code = parseInt(token.slice(2), 16);
      else if (/^\d{1,2}$/.test(token)) code = Number(token);
      else throw new SyntaxError("Unknown SSI-263 phoneme: " + token);
      return requireInteger(code, 0, 63, "Phoneme code");
    });
  }
  // Offline helper, deliberately separate from the chip's Tick/GenerateSample interface.
  // Dispatch phoneme writes at INTEGER HOST TICK boundaries even when they fall
  // between PCM samples. This avoids adding a rounded PCM sample per phoneme.
  function renderSequence(sequence, options = {}) {
    const codes = typeof sequence === "string" ? parseSequence(sequence) : Array.from(sequence);
    if (!codes.length || codes.length > 4096) throw new RangeError("Enter 1 to 4096 phonemes");
    codes.forEach(p => requireInteger(p, 0, 63, "Phoneme code"));
    const config = {
      sampleRate: 44100, xck: 1789772.5, tickClock: 1020484,
      duration: 0, rate: 4, inflection: 1536, articulation: 4, amplitude: 15, filter: 211,
      ...options
    };
    requireInteger(config.sampleRate, 8000, 96000, "Render sample rate");
    for (const [key,max] of [["duration",3],["rate",15],["inflection",4095],
      ["articulation",7],["amplitude",15],["filter",255]]) requireInteger(config[key],0,max,key);
    requirePositive(config.xck, "XCK"); requirePositive(config.tickClock, "Tick clock");
    // Limits keep integer tick scheduling safe and bound CPU/memory use.
    if (config.xck < 500000 || config.xck > 4000000) throw new RangeError("Render XCK must be 500000 to 4000000 Hz");
    if (config.tickClock < 10000 || config.tickClock > 10000000) throw new RangeError("Render tick clock must be 10000 to 10000000 Hz");
    const chip = new SSI263(config.xck);
    chip.SetTickClock(config.tickClock); chip.SetSampleRate(config.sampleRate);
    const infl = config.inflection;
    chip.WriteRegister(0, 0xc0 | codes[0]); // latch phoneme mode 3 at power up
    chip.WriteRegister(1, (infl >>> 3) & 255);
    chip.WriteRegister(2, (config.rate << 4) | ((infl & 0x800) ? 8 : 0) | (infl & 7));
    chip.WriteRegister(4, config.filter);
    chip.WriteRegister(3, (config.articulation << 4) | config.amplitude);
    chip.WriteRegister(0, (config.duration << 6) | codes[0]);
    const registers = chip.GetRegisters();
    const cyclesPerPhoneme = Math.ceil(chip.GetPhonemeDurationSec() * config.tickClock);
    const totalTicks = cyclesPerPhoneme * codes.length;
    const durationSec = totalTicks / config.tickClock;
    if (durationSec > 60) throw new RangeError("Rendered speech must be at most 60 seconds; reduce the sequence or increase the rate");
    const endSample = Math.ceil(totalTicks * config.sampleRate / config.tickClock);
    const samples = new Float32Array(endSample + Math.ceil(config.sampleRate * 0.1) + 1);
    const segments = codes.map((code,index) => ({
      code, name: PHONEMES[code].name,
      startSample: Math.ceil(index * cyclesPerPhoneme * config.sampleRate / config.tickClock),
      endSample: Math.ceil((index + 1) * cyclesPerPhoneme * config.sampleRate / config.tickClock)
    }));
    let now = 0, deadline = cyclesPerPhoneme, phoneme = 0, count = 0;
    for (let i = 0; i < samples.length; i++) {
      const target = Math.floor(i * config.tickClock / config.sampleRate);
      while (phoneme < codes.length && target >= deadline) {
        chip.Tick(deadline - now); now = deadline; phoneme++;
        if (phoneme < codes.length) {
          chip.WriteRegister(0, (config.duration << 6) | codes[phoneme]);
          deadline += cyclesPerPhoneme;
        }
      }
      chip.Tick(target - now); now = target;
      if (phoneme === codes.length && chip.IsSilent()) break;
      samples[i] = chip.GenerateSample(); count = i + 1;
    }
    return {samples: samples.slice(0,count), sampleRate: config.sampleRate, segments, registers, config};
  }
  function encodeWav(samples, sampleRate) {
    requireInteger(sampleRate, 8000, 96000, "WAV sample rate");
    if (!(samples instanceof Float32Array) || samples.length > 96000*61) throw new TypeError("WAV input must be a bounded Float32Array");
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    const tag = (offset, value) => { for (let i=0;i<value.length;i++) bytes[offset+i] = value.charCodeAt(i); };
    tag(0,"RIFF"); view.setUint32(4,bytes.length-8,true); tag(8,"WAVE");
    tag(12,"fmt "); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    tag(36,"data"); view.setUint32(40,samples.length*2,true);
    for (let i=0;i<samples.length;i++) {
      if (!Number.isFinite(samples[i])) throw new RangeError("WAV samples must be finite");
      const x = clamp(samples[i],-1,1);
      view.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);
    }
    return bytes;
  }
  return { SSI263, parseSequence, renderSequence, encodeWav };
});
// RetroAppleJS device adapter. The MIT-licensed chip engine above is preserved
// byte for byte from the validated SSI263.js port. The card owns the shared sink.
function MockingboardVoice(options)
{
    options=options||{};
    var device=this, api=typeof(SSI263Tools)!=="undefined"?SSI263Tools:module.exports;
    var live=new api.SSI263(), rendered=new api.SSI263();
    var owner=null, io=null, enabled=true, cpuTick=0, tickClock=1021800;
    var sampleRate=44100, renderTick=0, nextSample=1000000000/sampleRate;
    var previousSample=0, heldSample=0, lastSample=0, events=[], head=0;
    var lastRequest=false, generatedSamples=0;
    const TIMEBASE=1000000000, EVENT_CAPACITY=4096;
    this.soundSourceDevice=true;
    this.id={DCODE:"MOCKVOICE",coID:"MockingboardVoice",hostPCODE:"MOCK",deviceN:4,
        icon:"fa fa-comment",description:"SSI-263 speech synthesizer"};
    live.SetTickClock(tickClock);
    rendered.SetSampleRate(sampleRate);
    function mapped(tick){return typeof(options.mapCpuTick)==="function"?options.mapCpuTick(tick):tick*TIMEBASE/tickClock;}
    function notify(force)
    {
        var request=live.IsRequesting();
        var changed=request!==lastRequest;
        if(changed)
        {
            lastRequest=request;
            if(typeof(options.onRequestChange)==="function")options.onRequestChange(request);
        }
        if((changed||force) && typeof(device._ioRefreshHooks)==="function")device._ioRefreshHooks();
    }
    function queue(type,value,at)
    {
        if(events.length-head>=EVENT_CAPACITY && typeof(options.flushAudio)==="function")options.flushAudio();
        if(events.length-head>=EVENT_CAPACITY)throw new Error("Mockingboard speech event queue full");
        if(head && (head>1024 || events.length===head)){events=events.slice(head);head=0;}
        if(at<renderTick || events.length>head && at<events[events.length-1].tick)
            throw new Error("Mockingboard speech event order");
        events.push({type:type,value:value,tick:at});
    }
    function apply(event)
    {
        switch(event.type)
        {
            case "write":rendered.WriteRegister(event.value[0],event.value[1]);break;
            case "complete":rendered.Tick(0xffffffff);break;
            case "xck":rendered.SetXckClock(event.value);break;
            case "rate":
                sampleRate=event.value;rendered.SetSampleRate(sampleRate);
                lastSample=event.tick;nextSample=event.tick+TIMEBASE/sampleRate;break;
            case "reset":rendered.Reset();previousSample=heldSample=0;break;
        }
    }
    this.advanceTo=function(tick)
    {
        tick=Math.floor(Number(tick));
        if(!Number.isSafeInteger(tick)||tick<cpuTick)return;
        var elapsed=tick-cpuTick;
        if(live.m_sounding && elapsed>=Math.ceil(live.m_phonemeCycles))
        {
            var completed=cpuTick+Math.ceil(live.m_phonemeCycles);
            queue("complete",null,mapped(completed));
        }
        while(elapsed>0){var part=Math.min(elapsed,0xffffffff);live.Tick(part);elapsed-=part;}
        cpuTick=tick;notify();
    };
    this.writeRegister=function(reg,value,tick)
    {
        reg=Number(reg)&7;value=Number(value)&255;
        this.advanceTo(tick===undefined?cpuTick:tick);
        queue("write",[reg,value],mapped(cpuTick));
        live.WriteRegister(reg,value);notify(true);
    };
    this.readStatus=function(){return live.ReadStatus();};
    this.hasRenderEventsThrough=function(tick){return head<events.length && events[head].tick<=tick;};
    this.isEnabled=function(){return enabled;};
    this.needsRealtimeTick=function(){return enabled && live.m_sounding && !live.IsPoweredDown();};
    // The DSP follows timestamped logical completion events, not elapsed host
    // audio. Thus a queued earlier phoneme survives a later CPU-side A/R.
    this.sampleAt=function(target)
    {
        if(target<renderTick)throw new Error("Mockingboard speech render time reversed");
        if(head===events.length && rendered.IsSilent())
        {
            var step=TIMEBASE/sampleRate;
            if(nextSample<=target)nextSample+=(Math.floor((target-nextSample)/step)+1)*step;
            lastSample=nextSample-step;renderTick=target;previousSample=heldSample=0;
            return 0;
        }
        while(nextSample<=target || head<events.length && events[head].tick<=target)
        {
            var event=head<events.length?events[head]:null;
            if(event && event.tick<nextSample)
            {
                apply(event);head++;continue;
            }
            if(nextSample<=target)
            {
                previousSample=heldSample;
                heldSample=rendered.IsSilent()?0:rendered.GenerateSample();
                lastSample=nextSample;nextSample+=TIMEBASE/sampleRate;generatedSamples++;
            }
            else {apply(event);head++;}
        }
        renderTick=target;
        if(head===events.length){events=[];head=0;}
        var fraction=Math.max(0,Math.min(1,(target-lastSample)/(TIMEBASE/sampleRate)));
        return enabled?previousSample+(heldSample-previousSample)*fraction:0;
    };
    this.mixFrames=function(startTick,startPhase,frames,output,end)
    {
        if(head===events.length && rendered.IsSilent()){this.sampleAt(end);return;}
        for(var i=0;i<frames;i++)
        {
            var tick=startTick+Math.ceil(((i+1)*TIMEBASE-startPhase)/22050);
            var mono=this.sampleAt(tick)*0.5;
            output.left[i]=Math.max(-1,Math.min(1,output.left[i]+mono));
            output.right[i]=Math.max(-1,Math.min(1,output.right[i]+mono));
        }
        this.sampleAt(end);
    };
    this.rebaseAudio=function(origin)
    {
        events=[];head=0;renderTick=origin;lastSample=origin;
        sampleRate=this.pcmSampleRate||44100;rendered.SetSampleRate(sampleRate);
        rendered.m_reg.set(live.GetRegisters());rendered.m_mode=live.GetActiveMode();
        rendered.m_sounding=live.m_sounding;rendered.m_request=live.IsRequesting();
        rendered.m_phonemeCycles=live.m_phonemeCycles;rendered.SetXckClock(live.m_xckHz);
        nextSample=origin+TIMEBASE/sampleRate;
    };
    this.reset=function(clock,tick)
    {
        tickClock=Number(clock)||tickClock;
        if(tick!==undefined)cpuTick=Number(tick)||0;
        else if(io && typeof(io.getClockTicks)==="function")cpuTick=io.getClockTicks();
        live.Reset();live.SetTickClock(tickClock);rendered.Reset();
        previousSample=heldSample=0;generatedSamples=0;this.rebaseAudio(0);notify();
    };
    this.pcmSampleRate=sampleRate;
    this.setSampleRate=function(rate,tick)
    {
        rate=Number(rate);
        if(![22050,44100,48000].includes(rate))throw new RangeError("Speech PCM rate must be 22050, 44100 or 48000 Hz");
        this.advanceTo(tick===undefined?cpuTick:tick);
        queue("rate",rate,mapped(cpuTick));this.pcmSampleRate=rate;
    };
    this.setParameter=function(name,value,tick)
    {
        value=Number(value);this.advanceTo(tick===undefined?cpuTick:tick);
        if(name==="sampleRate"){this.setSampleRate(value,cpuTick);return;}
        if(name==="xck")
        {
            if(!Number.isFinite(value)||value<500000||value>4000000)throw new RangeError("XCK must be 500000–4000000 Hz");
            queue("xck",value,mapped(cpuTick));live.SetXckClock(value);return;
        }
        var ranges={duration:3,rate:15,inflection:4095,articulation:7,amplitude:15,filter:255};
        if(!Object.prototype.hasOwnProperty.call(ranges,name)||!Number.isInteger(value)||value<0||value>ranges[name])
            throw new RangeError("Invalid SSI-263 "+name+" value");
        var regs=live.GetRegisters();
        switch(name)
        {
            case "duration":this.writeRegister(0,(value<<6)|(regs[0]&63));break;
            case "rate":this.writeRegister(2,(value<<4)|(regs[2]&15));break;
            case "inflection":
                this.writeRegister(1,(value>>>3)&255);
                this.writeRegister(2,(regs[2]&240)|((value&2048)?8:0)|(value&7));break;
            case "articulation":this.writeRegister(3,(regs[3]&143)|(value<<4));break;
            case "amplitude":this.writeRegister(3,(regs[3]&240)|value);break;
            case "filter":this.writeRegister(4,value);break;
        }
    };
    this.playPhoneme=function(code,tick)
    {
        code=Number(code);if(!Number.isInteger(code)||code<0||code>63)throw new RangeError("Invalid phoneme");
        this.advanceTo(tick===undefined?cpuTick:tick);
        var regs=live.GetRegisters(), duration=regs[0]&192;
        this.writeRegister(3,regs[3]|128);this.writeRegister(0,192|code);
        this.writeRegister(3,regs[3]&127);this.writeRegister(0,duration|code);
    };
    this.stop=function(tick){this.writeRegister(3,live.GetRegisters()[3]|128,tick);};
    this.getState=function()
    {
        return {enabled:enabled,attached:!!owner,registers:Array.from(live.GetRegisters()),
            phoneme:live.GetPhoneme(),duration:live.GetDurationSel(),rate:live.GetRateSel(),
            inflection:live.GetInflectionValue(),articulation:live.GetArticulation(),amplitude:live.GetAmplitude(),
            filter:live.GetRegisters()[4],xck:live.m_xckHz,sampleRate:this.pcmSampleRate,
            requesting:live.IsRequesting(),poweredDown:live.IsPoweredDown(),sounding:live.m_sounding,mode:live.GetActiveMode(),
            phonemeDurationSec:live.GetPhonemeDurationSec(),pitchHz:live.GetInflectionFrequencyHz(),
            filterHz:live.GetFilterFrequencyHz(),pendingEvents:events.length-head,generatedSamples:generatedSamples};
    };
    this.bindHost=function(host)
    {
        if(!host||host.id?.PCODE!=="MOCK"||host.getVoiceDevice?.()!==device)return false;
        owner=host;enabled=true;return true;
    };
    this.bindIO=function(hostIO){io=hostIO;return !!io;};
    this.isTickActive=function()
    {
        // The audio device already ticks the card, including speech IRQs.
        return !!(owner && owner.needsRealtimeTick() && !owner.devices?.some(function(d){return d.id?.DCODE==="MOCKAUDIO";}));
    };
    this.tick=function(){if(owner&&io?.getClockTicks)owner.advanceTo(io.getClockTicks());};
    this.onUnmount=function(){this.stop(cpuTick);enabled=false;notify();};
    this.unbindHost=function(host){if(host!==owner)return false;this.onUnmount();owner=null;io=null;return true;};
    this.controlsHTML=function(access,id)
    {
        var state=this.getState();
        var html="<div style='font:12px Arial;text-align:left'><b>SSI-263 voice</b>";
        var labels={duration:"Duration bits (DR)",rate:"Rate (R)",inflection:"Inflection (I)",
            articulation:"Articulation (T)",amplitude:"Amplitude (A)",filter:"Filter (F)"};
        var limits={duration:3,rate:15,inflection:4095,articulation:7,amplitude:15,filter:255};
        for(var key in labels)
            html+="<label style='display:flex;justify-content:space-between;margin-top:9px' for='"+id(key)+"'>"+labels[key]+
                "<span id='"+id(key+"_value")+"'>"+state[key]+"</span></label>"+
                "<input id='"+id(key)+"' type=range min=0 max="+limits[key]+" step=1 value='"+state[key]+
                "' style='width:100%' oninput='"+access+"?.deviceToolVoiceChange(\""+key+"\",this.value)'>";
        html+="<label for='"+id("xck")+"'>XCK clock (Hz)</label><input id='"+id("xck")+
            "' type=number min=500000 max=4000000 step=0.5 value='"+state.xck+
            "' style='width:100%;box-sizing:border-box' onchange='"+access+"?.deviceToolVoiceChange(\"xck\",this.value)'>";
        html+="<label for='"+id("sampleRate")+"'>PCM sample rate</label><select id='"+id("sampleRate")+
            "' style='width:100%' onchange='"+access+"?.deviceToolVoiceChange(\"sampleRate\",this.value)'>";
        for(var rate of [22050,44100,48000])html+="<option value="+rate+(state.sampleRate===rate?" selected":"")+">"+rate.toLocaleString()+" Hz</option>";
        html+="</select><div style='display:flex;gap:4px;align-items:center;margin-top:10px'><select id='"+id("phoneme")+"' title='Phoneme to audition'>";
        for(var p of api.SSI263.PHONEMES)html+="<option value="+p.code+(state.phoneme===p.code?" selected":"")+">$"+p.code.toString(16).toUpperCase().padStart(2,"0")+" "+p.name+"</option>";
        html+="</select><button class=appbut onclick='"+access+"?.deviceToolVoicePlay()' title='Audition selected phoneme'><i class='fa fa-play'></i></button>"+
            "<button class=appbut onclick='"+access+"?.deviceToolVoiceStop()' title='Power down speech'><i class='fa fa-stop'></i></button>"+
            "<button class=appbut onclick='"+access+"?.deviceToolVoiceDefaults()' title='Load laboratory voice defaults'><i class='fa fa-undo'></i> Defaults</button></div>"+
            "<div id='"+id("status")+"' role=status style='margin-top:8px;overflow-wrap:anywhere'></div>"+
            "<div style='font-size:10px;margin-top:6px'>For an audition, load Defaults and click Play. Software writes update these controls. Parameter edits preserve power down.</div></div>";
        return html;
    };
}
if(typeof(module)==="object" && module.exports)module.exports.MockingboardVoice=MockingboardVoice;
