import type { Context } from 'https://edge.netlify.com';
import { connect } from 'https://unpkg.com/@planetscale/database@^0.6.1';
import { createMachine } from 'https://cdn.skypack.dev/xstate';

const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      on: { NEXT: 'yellow' },
    },
    yellow: {
      on: { NEXT: 'red' },
    },
    red: {
      on: { NEXT: 'green' },
    },
  },
});

async function createWorkflow(machineConfig: any) {
  const conn = connect({ url: Deno.env.get('DATABASE_URL') });

  try {
    const machine = createMachine(machineConfig);

    const data = await conn.execute(
      'INSERT INTO workflows (state, machine) VALUES (?, ?)',
      [JSON.stringify(machine.initialState), JSON.stringify(machine)]
    );

    console.log(data);

    return data.insertId;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

export default async function handler(req: Request, context: Context) {
  const conn = connect({ url: Deno.env.get('DATABASE_URL') });
  const data = await conn.execute('SELECT * FROM workflows WHERE id = ?', [1]);

  if (req.method === 'POST') {
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    console.log(searchParams.get('id'));
    const machineConfig = await req.json();

    const workflowId = await createWorkflow(machineConfig);

    return new Response(
      JSON.stringify({
        workflowId,
      }),
      {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'access-control-allow-origin': '*',
        },
      }
    );
    // console.log(await req.json());
    // const machineData = data.rows[0];
    // const machine = createMachine(machineData.machine);
    // const nextState = machine.transition(
    //   machine.resolveState(machineData.state),
    //   { type: 'NEXT' }
    // );

    // await conn.execute('UPDATE workflows SET state = ? WHERE id = ?', [
    //   JSON.stringify(nextState),
    //   1,
    // ]);
    // return new Response('Updated state', { status: 200 });

    // return new Response();
    // const data = await conn.execute(
    //   'INSERT INTO workflows (state, machine) VALUES (?, ?)',
    //   [JSON.stringify(machine.initialState), JSON.stringify(machine)]
    // );
    // console.log(data);

    return new Response();
  } else if (req.method === 'PUT') {
    await conn.execute('UPDATE workflows SET state = ? WHERE id = ?', [
      JSON.stringify({ value: 'change me' }),
      1,
    ]);
    return new Response();
  } else {
    const json = JSON.stringify(data.rows);

    return new Response(json, {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'access-control-allow-origin': '*',
      },
    });
  }

  // update workflow where id = 1 with new state
  // await conn.execute(
  //   'UPDATE workflows SET state = ? WHERE id = ?',
  //   [JSON.stringify({ value: 'testing' }), 1]
  // );
}
