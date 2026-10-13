import { describe, it, expect } from 'vitest';
import { App } from './App';

describe('App component', () => {
  it('should be defined as a function component', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});
