import type { Context } from 'https://edge.netlify.com';
import { connect } from 'https://unpkg.com/@planetscale/database@^0.6.1';
import { createMachine } from 'https://cdn.skypack.dev/xstate';

const machine =
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOigCcwx8BiAOQFEANAFUVAAcB7WXAF1xd87EAA9EARgAsEkgE4pAVgDMAJmVSADIpkA2OboA0IAJ6JV0+XOsAOCcsWLVOmwHYAvu+NoseQqRMwABsgrgB3emY2JBBuXgEhEXEECRtVEhs3V1ddRVcdJWzjMwRlexIpG2VdBxsFCUU5G09vDBwCYhJKCBIw9CCAaxoAYQB5AFU6FgARUYB1OhE4-kFhGOSJVVd5V1UbRU2FVV0JBWLEA7kSJ00JCW09JVUWkB92-y7IXvR+EYmp2YLJY8FaJdaSLY7Pa6VR7HLOGxSc4IXI2EgSVw2fRqXS3VwSF5vPydbo0CBCMAkWB8dB8SlEjqkbrA+KrJKIZQaEiqTRlKT5aRaOSqJGmRB1KzWXZyTYOaQEl74LgQOAiBkfChUNacEEJbViRBSVTImUkXTm3JSBSaGSpXSEtrEgLBUJhFmg-XJdSKDJSZQ5OoGFR7ZE8q5WqXCqRPOSaZ5eV6OxmfHp9QbuvXslIHEgaRFYu6ubQioxihDRq5FzHSRQ1NKaZoJ9Ukr59fgZtnglIw9HVGW7EWnaQ2ZF5NGbXlyZRyWtGmUO3zJ7pUvhcDgdsGgDa6baZf08jE2BunUUlVxla6KG26I23ZT7OQL94tiAbz2SXlQ-aHI0nM5l-1tirVw5ByTE70fJsk38N8s1SZEMUlUCj3sLZYSkTxPCAA */
  createMachine({
    id: '(machine)',
    initial: 'green',
    states: {
      green: {
        on: {
          NEXT: {
            target: 'yellow',
          },
        },
      },
      yellow: {
        on: {
          NEXT: {
            target: 'red',
          },
        },
      },
      red: {
        initial: 'walk',
        states: {
          walk: {
            on: {
              COUNTDOWN: {
                target: 'wait',
              },
            },
          },
          wait: {
            on: {
              COUNTDOWN: {
                target: 'stop',
              },
            },
          },
          stop: {
            type: 'final',
          },
        },
        onDone: {
          target: 'green',
        },
      },
    },
  });

const DEFAULT_WORKFLOW_ID = 1;

export default async function handler(req: Request, context: Context) {
  const conn = connect({ url: Deno.env.get('DATABASE_URL') });

  if (req.method === 'GET') {
    const data = await conn.execute('SELECT * FROM workflows WHERE id = ?', [
      DEFAULT_WORKFLOW_ID,
    ]);

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
      [DEFAULT_WORKFLOW_ID]
    );

    const workflowData = workflowResult.rows[0];

    const nextState = machine.transition(
      machine.resolveState(workflowData.state),
      eventData
    );

    await conn.execute(
      'UPDATE workflows SET state = ?, machine = ? WHERE id = ?',
      [JSON.stringify(nextState), JSON.stringify(machine), DEFAULT_WORKFLOW_ID]
    );

    return new Response('Event sent', {
      status: 200,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'access-control-allow-origin': '*',
      },
    });
  }
}
