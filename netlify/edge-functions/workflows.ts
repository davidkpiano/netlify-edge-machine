import type { Context } from 'https://edge.netlify.com';
import { connect } from 'https://unpkg.com/@planetscale/database@^0.6.1';
import { createMachine } from 'https://cdn.skypack.dev/xstate';

async function createWorkflow(machineConfig: any): Promise<number> {
  const conn = connect({ url: Deno.env.get('DATABASE_URL') });

  const machine = createMachine(machineConfig);

  const data = await conn.execute(
    'INSERT INTO workflows (state, machine) VALUES (?, ?)',
    [JSON.stringify(machine.initialState), JSON.stringify(machine)]
  );

  return data.insertId;
}

export default async function handler(req: Request, context: Context) {
  const conn = connect({ url: Deno.env.get('DATABASE_URL') });
  const url = new URL(req.url);
  const searchParams = new URLSearchParams(url.search);
  const workflowId = searchParams.get('id');

  if (workflowId) {
    if (req.method === 'GET') {
      const data = await conn.execute('SELECT * FROM workflows WHERE id = ?', [
        workflowId,
      ]);

      if (!data.rows.length) {
        return new Response(`Workflow with id: ${workflowId} not found`, {
          status: 404,
          headers: {
            'content-type': 'application/json;charset=UTF-8',
            'access-control-allow-origin': '*',
          },
        });
      }
      const json = JSON.stringify(data.rows[0]);

      return new Response(json, {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'access-control-allow-origin': '*',
        },
      });
    }

    if (req.method === 'POST') {
      const eventData = await req.json();

      const workflowResult = await conn.execute(
        'SELECT * FROM workflows WHERE id = ?',
        [workflowId]
      );

      // Alter table and add created_at and updated_at columsn
      await conn.execute(
        'ALTER TABLE workflows ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      );
      await conn.execute(
        'ALTER TABLE workflows ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      );

      const workflowData = workflowResult.rows[0];

      const machine = createMachine(workflowData.machine);
      const nextState = machine.transition(
        machine.resolveState(workflowData.state),
        eventData
      );

      await conn.execute('UPDATE workflows SET state = ? WHERE id = ?', [
        JSON.stringify(nextState),
        workflowId,
      ]);

      return new Response('Event sent', {
        status: 200,
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'access-control-allow-origin': '*',
        },
      });
    }
  } else {
    if (req.method === 'GET') {
      const data = await conn.execute('SELECT * FROM workflows');

      const json = JSON.stringify(data.rows);

      return new Response(json, {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'access-control-allow-origin': '*',
        },
      });
    } else if (req.method === 'POST') {
      const newWorkflowId = await createWorkflow(await req.json());

      return new Response(
        JSON.stringify({
          workflowId: newWorkflowId,
        }),
        {
          headers: {
            'content-type': 'application/json;charset=UTF-8',
            'access-control-allow-origin': '*',
          },
        }
      );
    }
  }
}
