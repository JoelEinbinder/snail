/*
 * Copyright (C) 2013 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export class FilePathScoreFunction {
  private query: string;
  private readonly queryUpperCase: string;
  private score: Int32Array;
  private sequence: Int32Array;
  private dataUpperCase: string;
  private fileNameIndex: number;
  private lastDataUpperCase: string;

  private _filterRegex: RegExp;
  constructor(query: string) {
    this.query = query;
    this.queryUpperCase = query.toUpperCase();
    this.score = new Int32Array(20 * 100);
    this.sequence = new Int32Array(20 * 100);
    this.dataUpperCase = '';
    this.fileNameIndex = 0;
    this.lastDataUpperCase = '';
    this._filterRegex = makeFilterRegex(query);
  }

  calculateScore(data: string, matchIndexes: number[]|null): number {
    if (!data || !this.query || !this._filterRegex.test(data)) {
      return 0;
    }
    const n = this.query.length;
    const m = data.length;
    if (!this.score || this.score.length < n * m) {
      this.score = new Int32Array(n * m * 2);
      this.sequence = new Int32Array(n * m * 2);
      this.lastDataUpperCase = '';
    }
    const score = this.score;
    const sequence = (this.sequence as Int32Array);
    this.dataUpperCase = data.toUpperCase();
    this.fileNameIndex = data.lastIndexOf('/');
    let start = 0;
    while (start < this.lastDataUpperCase.length && this.lastDataUpperCase[start] === this.dataUpperCase[start]) {
      start++;
    }
    this.lastDataUpperCase = this.dataUpperCase;
    for (let j = start; j < m; ++j) {
      for (let i = 0; i < n; ++i) {
        const skipCharScore = j === 0 ? 0 : score[i + (j - 1) * n];
        const prevCharScore = i === 0 || j === 0 ? 0 : score[(i - 1) + (j - 1) * n];
        const consecutiveMatch = i === 0 || j === 0 ? 0 : sequence[(i - 1) + (j - 1) * n];
        const pickCharScore = this.match(this.query, data, i, j, consecutiveMatch);
        if (pickCharScore && prevCharScore + pickCharScore >= skipCharScore) {
          sequence[i + j * n] = consecutiveMatch + 1;
          score[i + j * n] = (prevCharScore + pickCharScore);
        } else {
          sequence[i + j * n] = 0;
          score[i + j * n] = skipCharScore;
        }
      }
    }
    if (matchIndexes) {
      this.restoreMatchIndexes(sequence, n, m, matchIndexes);
    }
    const maxDataLength = 256;
    return score[n * m - 1] * maxDataLength + (maxDataLength - data.length);
  }

  private testWordStart(data: string, j: number): boolean {
    if (j === 0) {
      return true;
    }

    const prevChar = data.charAt(j - 1);
    return prevChar === '_' || prevChar === '-' || prevChar === '/' || prevChar === '.' || prevChar === ' ' ||
        (data[j - 1] !== this.dataUpperCase[j - 1] && data[j] === this.dataUpperCase[j]);
  }

  private restoreMatchIndexes(sequence: Int32Array, n: number, m: number, out: number[]): void {
    let i = n - 1, j = m - 1;
    while (i >= 0 && j >= 0) {
      switch (sequence[i + j * n]) {
        case 0:
          --j;
          break;
        default:
          out.push(j);
          --i;
          --j;
          break;
      }
    }
    out.reverse();
  }

  private singleCharScore(query: string, data: string, i: number, j: number): number {
    const isWordStart = this.testWordStart(data, j);
    const isFileName = j > this.fileNameIndex;
    const isPathTokenStart = j === 0 || data[j - 1] === '/';
    const isCapsMatch = query[i] === data[j] && query[i] === this.queryUpperCase[i];
    let score = 10;
    if (isPathTokenStart) {
      score += 4;
    }
    if (isWordStart) {
      score += 2;
    }
    if (isCapsMatch) {
      score += 6;
    }
    if (isFileName) {
      score += 4;
    }
    // promote the case of making the whole match in the filename
    if (j === this.fileNameIndex + 1 && i === 0) {
      score += 5;
    }
    if (isFileName && isWordStart) {
      score += 3;
    }
    return score;
  }

  private sequenceCharScore(query: string, data: string, i: number, j: number, sequenceLength: number): number {
    const isFileName = j > this.fileNameIndex;
    const isPathTokenStart = j === 0 || data[j - 1] === '/';
    let score = 10;
    if (isFileName) {
      score += 4;
    }
    if (isPathTokenStart) {
      score += 5;
    }
    score += sequenceLength * 4;
    return score;
  }

  private match(query: string, data: string, i: number, j: number, consecutiveMatch: number): number {
    if (this.queryUpperCase[i] !== this.dataUpperCase[j]) {
      return 0;
    }

    if (!consecutiveMatch) {
      return this.singleCharScore(query, data, i, j);
    }
    return this.sequenceCharScore(query, data, i, j - consecutiveMatch, consecutiveMatch);
  }
}

const SPECIAL_REGEX_CHARACTERS = '^[]{}()\\.^$*+?|-,';
export function makeFilterRegex(query: string): RegExp {
  let regexString = '';
  for (let i = 0; i < query.length; ++i) {
    let c = query.charAt(i);
    if (SPECIAL_REGEX_CHARACTERS.indexOf(c) !== -1) {
      c = '\\' + c;
    }
    if (i) {
      regexString += '[^\\0' + c + ']*';
    }
    regexString += c;
  }
  return new RegExp(regexString, 'i');
};