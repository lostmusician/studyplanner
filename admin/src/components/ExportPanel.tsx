import type { Major } from '@shared/types';

interface Props {
  major: Major;
}

export const ExportPanel = ({ major }: Props) => {
  const json = JSON.stringify(major, null, 2);

  const handleSave = async () => {
    if (!('showSaveFilePicker' in window)) {
      fallbackDownload(major.id, json);
      return;
    }

    try {
      const fileHandle = await (window as Window & typeof globalThis & {
        showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: `${major.id}.json`,
        types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        fallbackDownload(major.id, json);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(json).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Export Major JSON</h3>
      <p className="text-xs text-muted leading-relaxed">
        Save the JSON file to <code className="font-mono bg-paper px-1 rounded">shared/data/majors/{major.id}.json</code> for the student app to pick it up.
      </p>
      <pre className="rounded-xl bg-paper p-3 text-[10px] font-mono text-ink/70 overflow-auto max-h-48">
        {json}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          Save file…
        </button>
        <button
          onClick={handleCopy}
          className="rounded-xl bg-paper border border-ink/20 text-ink px-4 py-2 text-sm hover:bg-canvas transition-colors"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
};

const fallbackDownload = (id: string, json: string) => {
  const a = document.createElement('a');
  a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  a.download = `${id}.json`;
  a.click();
};
