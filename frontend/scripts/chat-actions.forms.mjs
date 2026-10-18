import assert from 'node:assert/strict';
import { setup, form, proposal } from './chat-actions.fixtures.mjs';

export async function verifyForms(browser) {
  const { page, state, errors } = await setup(browser);
  try {
    state.operations = [form('RUN_WORKFLOW')];
    await page.locator('.chatStarters .tile').nth(0).click();
    const workflows = page.getByRole('button', { name: /Saved workflow/ });
    await workflows.click();
    await page.getByRole('option', { name: 'Deploy nginx', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: /Workflow draft/ }).count(), 0, 'running a workflow never opens a new draft');
    assert.equal(state.writes.length, 0);
    await page.getByRole('button', { name: 'Choose servers and review run' }).click();
    const run = page.getByRole('dialog');
    await run.getByRole('checkbox', { name: /Lab server/ }).check();
    assert.equal(state.writes.length, 0, 'selecting a workflow and server does not execute');
    await run.getByRole('button', { name: 'Start', exact: true }).click();
    await run.getByText('Run checked without executing').waitFor();
    assert.deepEqual(state.writes[0].data.machineIds, [8]);
    assert.equal(state.writes[0].path, '/api/workflows/5/run');
    await run.getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.getByRole('button', { name: 'New chat', exact: true }).click();
    state.operations = [form('ADD_CREDENTIAL')];
    await page.locator('.chatStarters .tile').nth(4).click();
    await page.getByRole('button', { name: 'Open secure credential form' }).click();
    const secure = page.getByRole('dialog');
    await secure.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(state.writes.length, 1, 'native validation blocks missing fields');
    await secure.locator('input[name=name]').fill('Lab SSH');
    await secure.locator('input[name=username]').fill('admin');
    await secure.locator('input[name=password]').fill('test-private-password');
    state.failCredential = true;
    await secure.getByRole('button', { name: 'Save', exact: true }).click();
    await secure.getByText('Credential save failed').waitFor();
    state.failCredential = false;
    await secure.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Credentials saved', { exact: true }).waitFor();
    assert.ok(!JSON.stringify(state.chats).includes('test-private-password'));
    assert.ok(!await page.locator('.chatInner').innerText().then(text => text.includes('test-private-password')));

    await page.getByRole('button', { name: 'New chat', exact: true }).click();
    state.operations = [proposal('PROPOSE_MACHINE', { name: 'New host', hostname: 'new.example', sshPort: 22 })];
    await page.locator('.chatStarters .tile').nth(1).click();
    await page.locator('.proposal').getByRole('button', { name: 'Add server', exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByRole('textbox', { name: 'Hostname or IP' }).inputValue(), 'new.example');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.getByRole('button', { name: 'New chat', exact: true }).click();
    state.operations = [proposal('PROPOSE_NEW_COMMAND', { name: 'Show date', commandTemplate: 'date', parameters: [], riskLevel: 'LOW' })];
    await page.locator('.chatStarters .tile').nth(3).click();
    await page.locator('.proposal').getByRole('button', { name: 'Add to Command Bank', exact: true }).click();
    await page.locator('.proposal').getByText('Added to the Command Bank', { exact: true }).waitFor();
    assert.equal(state.writes.at(-1).data.commandTemplate, 'date');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}
