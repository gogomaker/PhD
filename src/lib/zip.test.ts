import { describe, expect, it } from 'vitest';
import { crc32, makeZip, toCsv } from './zip';

const dec = new TextDecoder('utf-8', { ignoreBOM: true });

describe('CSV', () => {
  it('BOM + CRLF, 쉼표·따옴표·줄바꿈은 따옴표로 감싼다', () => {
    const t = dec.decode(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['줄\n바꿈', null]]));
    expect(t).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n"줄\n바꿈",\r\n');
  });
  it('엑셀 수식처럼 보이는 글은 앞에 작은따옴표', () => {
    expect(dec.decode(toCsv(['a'], [['=1+1'], ['-3kg 감량'], [-3]]))).toBe("﻿a\r\n'=1+1\r\n'-3kg 감량\r\n-3\r\n");
  });
});

describe('ZIP', () => {
  it('CRC32가 표준 확인값과 같다', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('파일 이름(한글)·내용이 그대로 들어가고 끝 레코드에 파일 수가 맞다', () => {
    const a = new TextEncoder().encode('hello');
    const z = makeZip([{ name: '목표.csv', data: a }, { name: 'b.csv', data: new Uint8Array() }], new Date(2026, 9, 1, 12, 0, 0));
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const nameLen = v.getUint16(26, true);
    expect(dec.decode(z.slice(30, 30 + nameLen))).toBe('목표.csv');
    expect(dec.decode(z.slice(30 + nameLen, 30 + nameLen + 5))).toBe('hello');
    const end = z.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
  });
});
