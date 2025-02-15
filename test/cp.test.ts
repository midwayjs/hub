import { join } from 'path';
import { createChildProcessWorker } from './util';
import { ChildProcessEventBus } from '../src';

describe('/test/cp.test.ts', function () {

  it('test init error', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/init_error.ts'));
    bus.addWorker(worker);

    const error = await new Promise<Error>((resolve, reject) => {
      bus.onError(err => {
        resolve(err);
      });

      bus.start();
    });

    expect(error).toBeDefined();
    expect(error.name).toEqual('CustomError');
    expect(error.message).toMatch('custom error');

    await worker.kill();
    await bus.stop();
  });

  it('test base thread publish and subscribe', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/base.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await new Promise(resolve => {
      bus.subscribe(message => {
        resolve(message.body);
      });

      bus.publish({
        data: {
          name: 'test',
        }
      }, {
        topic: 'target'
      });
    });

    expect(result).toEqual({ data: 'hello world' });

    worker.kill();
    await bus.stop();
  });

  it('test base subscribe with abort', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/base.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await new Promise(resolve => {
      const abortController = bus.subscribe(message => {
        resolve(message.body);
      });

      abortController.abort();

      bus.publish({
        data: {
          name: 'test',
        }
      }, {
        topic: 'target'
      });

      setTimeout(() => {
        resolve(null);
      }, 1000);
    });

    expect(result).toEqual(null);

    worker.kill();
    await bus.stop();
  });

  it('test publish with async', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_async.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual({ data: 'hello world' });

    await worker.kill();
    await bus.stop();
  });

  it('test publish with async and throw error', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_async_error.ts'));
    bus.addWorker(worker);
    await bus.start();

    let error;
    try {
      await bus.publishAsync({
        data: {
          name: 'test',
        }
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toEqual('CustomError');
    expect(error.message).toMatch('custom error');

    await worker.kill();
    await bus.stop();
  });

  it('test publish async with timeout error', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_async_timeout.ts'));
    bus.addWorker(worker);
    await bus.start();

    let error;
    try {
      await bus.publishAsync({
        data: {
          name: 'test',
        },
      }, {
        timeout: 1000,
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.message).toMatch('timeout');

    await worker.kill();
    await bus.stop();
  });

  it('test broadcast', async () => {
    const bus = new ChildProcessEventBus();
    let total = 0;

    const worker1 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 3) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      });
    })

    await worker1.kill();
    await worker2.kill();
    await worker3.kill();
    await bus.stop();
  });

  it('test broadcast without self no effect for main thread', async () => {
    const bus = new ChildProcessEventBus();
    let total = 0;

    const worker1 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/broadcast.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 3) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      },{
        includeSelfFromWorker: true,
        includeMainFromWorker: true,
      });
    })

    await worker1.kill();
    await worker2.kill();
    await worker3.kill();
    await bus.stop();
  });

  it('test broadcast from worker and trigger with self', async () => {
    const bus = new ChildProcessEventBus();
    let total = 0;

    const worker1 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it') {
          total++;
          console.log(total);
          if (total === 3) {
            resolve();
          }
        }
      });
    })

    await worker1.kill();
    await worker2.kill();
    await worker3.kill();
    await bus.stop();
  });

  it('test broadcast from worker and without self worker', async () => {
    const bus = new ChildProcessEventBus();
    let total = 0;

    const worker1 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_without_self.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_without_self.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_without_self.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it') {
          total++;
          if (total === 2) {
            resolve();
          }
        } else if (message.body === 'fail') {
          reject(new Error('fail'));
        }
      });
    })

    await worker1.kill();
    await worker2.kill();
    await worker3.kill();
    await bus.stop();
  });

  it('test broadcast from worker and trigger in main', async () => {
    const bus = new ChildProcessEventBus();
    let total = 0;

    const worker1 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_with_main.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_with_main.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/broadcast_worker_with_main.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it' || message.body.data === 'hello world') {
          total++;
          if (total === 3) {
            resolve();
          }
        } else if (message.body === 'fail') {
          reject(new Error('fail'));
        }
      });
    })

    worker1.kill();
    worker2.kill();
    worker3.kill();
    await bus.stop();
  });

  describe('test chunk', function () {
    it('test publish chunk and run end', async () => {
      const bus = new ChildProcessEventBus();
      const worker = createChildProcessWorker(join(__dirname, 'cp/publish_chunk.ts'));
      bus.addWorker(worker);
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await worker.kill();
      await bus.stop();
    });

    it('should publish chunk with topic', async () => {
      const bus = new ChildProcessEventBus();
      const worker = createChildProcessWorker(join(__dirname, 'cp/publish_chunk_topic.ts'));
      bus.addWorker(worker);
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      }, {
        topic: 'in-request'
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await worker.kill();
      await bus.stop();
    });

    it('test publish chunk and run end with data', async () => {
      const bus = new ChildProcessEventBus();
      const worker = createChildProcessWorker(join(__dirname, 'cp/publish_chunk_end_data.ts'));
      bus.addWorker(worker);
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await worker.kill();
      await bus.stop();
    });

    it('test publish chunk timeout', async () => {
      const bus = new ChildProcessEventBus();
      const worker = createChildProcessWorker(join(__dirname, 'cp/publish_chunk_timeout.ts'));
      bus.addWorker(worker);
      await bus.start();

      let error;
      try {
        const iterator = bus.publishChunk<string>({
          data: {
            name: 'test',
          },
        }, {
          timeout: 1000
        });

        let result = [];
        for await (const data of iterator) {
          result.push(data);
        }
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toMatch('timeout');

      await worker.kill();
      await bus.stop();
    });

    it('test publish chunk and worker throw error', async () => {
      const bus = new ChildProcessEventBus();
      const worker = createChildProcessWorker(join(__dirname, 'cp/publish_chunk_worker_error.ts'));
      bus.addWorker(worker);
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        },
      });

      let error;
      try {
        let result = [];
        for await (const data of iterator) {
          result.push(data);
        }
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toEqual('CustomError');
      expect(error.message).toMatch('custom error');

      await worker.kill();
      await bus.stop();
    });
  });

  it('test publish from worker', async () => {
    const bus = new ChildProcessEventBus({
      isWorker: false,
    });
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_from_worker.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await new Promise(resolve => {
      bus.subscribe(message => {
        resolve(message.body);
      });
    });

    expect(result).toEqual({ data: 'hello world' });

    worker.kill();
    await bus.stop();
  });

  it('test publish with custom dispatcher', async () => {
    const bus = new ChildProcessEventBus({
      dispatchStrategy: (workers) => {
        return workers[0];
      }
    });
    const worker1 = createChildProcessWorker(join(__dirname, 'cp/publish_custom_dispatcher.ts'));
    const worker2 = createChildProcessWorker(join(__dirname, 'cp/publish_custom_dispatcher.ts'));
    const worker3 = createChildProcessWorker(join(__dirname, 'cp/publish_custom_dispatcher.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);
    await bus.start();

    let result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual(String(worker1.pid));
    result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual(String(worker1.pid));
    result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual(String(worker1.pid));

    worker1.kill();
    worker2.kill();
    worker3.kill();
    await bus.stop();
  });

  it('should publish with custom dispatcher and throw when not found worker', async () => {
    const bus = new ChildProcessEventBus({
      dispatchStrategy: (workers) => {
        return undefined;
      }
    });
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_custom_dispatcher.ts'));
    bus.addWorker(worker);
    await bus.start();

    let error;
    try {
      await bus.publishAsync({
        data: {
          name: 'test',
        }
      });
    } catch (err) {
      error = err;
    }

    expect(error.name).toEqual('EventBusDispatchStrategyError');
    worker.kill();
    await bus.stop();
  });

  it('test publishAsync from child to main', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_async_from_worker.ts'));
    bus.addWorker(worker);
    await bus.start();

    await new Promise<void>(resolve => {
      // 订阅来自子进程的消息，并返回响应
      bus.subscribe((message, responder?) => {
        if (message.body.data === 'request from child') {
          responder?.send({
            data: 'response from main',
          });
        } else if (message.body.data === 'ok') {
          resolve();
        }
      });
    });

    await worker.kill();
    await bus.stop();
  });

  it('test publishAsync from child to main with timeout', async () => {
    const bus = new ChildProcessEventBus();
    const worker = createChildProcessWorker(join(__dirname, 'cp/publish_async_from_worker_timeout.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await new Promise<{error: {message: string}}>(resolve => {
      bus.subscribe((message) => {
        // 等待子进程发送的超时错误消息
        if (message.body?.error?.message) {
          resolve(message.body);
        }
      });

      // 主进程不响应子进程的请求,让其超时
    });

    // 验证超时错误消息
    expect(result.error.message).toMatch('timeout');
    await worker.kill();
    await bus.stop();
  });
});
