import { describe, it, expect } from 'bun:test';
import { PISTON_LANGUAGE_MAP } from '../src/lib/server/judge/piston';

describe('Piston Language Mapping', () => {
  it('correctly maps standard competitive programming languages', () => {
    expect(PISTON_LANGUAGE_MAP[50]).toEqual({ language: 'c', version: '*', filename: 'main.c' });
    expect(PISTON_LANGUAGE_MAP[54]).toEqual({ language: 'c++', version: '*', filename: 'main.cpp' });
    expect(PISTON_LANGUAGE_MAP[71]).toEqual({ language: 'python', version: '*', filename: 'main.py' });
    expect(PISTON_LANGUAGE_MAP[62]).toEqual({ language: 'java', version: '*', filename: 'Main.java' });
    expect(PISTON_LANGUAGE_MAP[73]).toEqual({ language: 'rust', version: '*', filename: 'main.rs' });
    expect(PISTON_LANGUAGE_MAP[60]).toEqual({ language: 'go', version: '*', filename: 'main.go' });
  });
});

