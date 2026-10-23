import { expect, it } from "vitest";
import { createStorageMigrationStatus } from "../server/utils/storageMigrationStatus";
import { parseFolderPickerOutput, windowsFolderPickerArgs } from "../server/utils/folderPicker";

it("round-trips Chinese, spaces and Unicode paths without console code-page decoding", () => {
  const folder = "C:\\用户\\音色素材 😀\\本地 资料";
  expect(parseFolderPickerOutput(`MIMO_FOLDER:${Buffer.from(folder,'utf8').toString('base64')}\r\n`)).toBe(folder);
  expect(parseFolderPickerOutput('')).toBeNull();
  expect(windowsFolderPickerArgs()).toContain('-EncodedCommand');
  expect(Buffer.from(windowsFolderPickerArgs().at(-1)!, 'base64').toString('utf16le')).toContain('UTF8.GetBytes($f.SelectedPath)');
});
it("rejects corrupt picker output instead of saving a broken path", () => {
  for(const output of ['乱码', 'MIMO_FOLDER:!!!!', `MIMO_FOLDER:${Buffer.from([255,254,253]).toString('base64')}`, `MIMO_FOLDER:${Buffer.from('relative/path').toString('base64')}`]) expect(()=>parseFolderPickerOutput(output)).toThrow();
});
it("reports real estimated remaining time, never falsely completes, and clears running on failure", () => {
  let time=1000;const status=createStorageMigrationStatus(()=>time);
  expect(status.snapshot().phase).toBe('idle');status.start();expect(status.snapshot().remainingSeconds).toBeNull();
  time+=2000;status.update({phase:'copying',totalFiles:10,processedFiles:2,totalBytes:1000,processedBytes:200});
  expect(status.snapshot().remainingSeconds).toBe(8);
  time+=3000;expect(status.snapshot().remainingSeconds).toBe(5);
  time+=10000;expect(status.snapshot()).toMatchObject({running:true,remainingSeconds:1});
  status.finish();expect(status.snapshot()).toMatchObject({running:false,phase:'completed',remainingSeconds:0});
  status.start();expect(status.snapshot().remainingSeconds).toBeNull();status.finish('失败');
  expect(status.snapshot()).toMatchObject({running:false,phase:'failed',error:'失败',remainingSeconds:null});
});
