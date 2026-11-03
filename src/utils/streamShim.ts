/**
 * Lightweight browser shim for Node.js 'stream' module.
 * Satisfies client bundlers (xlsx, docx) without pulling heavy Node Buffer dependencies.
 */
export class Stream {}
export class Readable extends Stream {
  static Readable = Readable;
}
export class Writable extends Stream {
  static Writable = Writable;
}
export class Duplex extends Stream {}
export class Transform extends Stream {}
export class PassThrough extends Stream {}

export default {
  Stream,
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
};
