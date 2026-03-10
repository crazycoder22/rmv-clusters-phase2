"use client";

import type { CustomFieldFormEntry } from "@/types";

function parseOptions(options: string): string[] {
  return options
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o && o !== "__OTHER__");
}

function buildOptions(opts: string[], includeOther: boolean): string {
  const parts = [...opts];
  if (includeOther) parts.push("__OTHER__");
  return parts.join(", ");
}

function hasOtherFlag(options: string): boolean {
  return options
    .split(",")
    .map((o) => o.trim())
    .includes("__OTHER__");
}

interface CustomFieldBuilderProps {
  fields: CustomFieldFormEntry[];
  onChange: (fields: CustomFieldFormEntry[]) => void;
}

export default function CustomFieldBuilder({ fields, onChange }: CustomFieldBuilderProps) {
  const addField = () => {
    onChange([
      ...fields,
      { tempId: crypto.randomUUID(), label: "", fieldType: "text", required: false, options: "" },
    ]);
  };

  const removeField = (tempId: string) => {
    onChange(fields.filter((f) => f.tempId !== tempId));
  };

  const updateField = (tempId: string, updates: Partial<CustomFieldFormEntry>) => {
    onChange(
      fields.map((f) => (f.tempId === tempId ? { ...f, ...updates } : f))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Custom Fields
        </label>
        <button
          type="button"
          onClick={addField}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          + Add Field
        </button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No custom fields added. Click &quot;+ Add Field&quot; to ask participants additional questions.
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.tempId} className="space-y-2 border border-gray-200 rounded-md p-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}.</span>
            <input
              type="text"
              value={field.label}
              onChange={(e) => updateField(field.tempId, { label: e.target.value })}
              placeholder="Field label (e.g., Profession)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <select
              value={field.fieldType}
              onChange={(e) =>
                updateField(field.tempId, {
                  fieldType: e.target.value as "text" | "select",
                  options: e.target.value === "text" ? "" : field.options,
                })
              }
              className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="text">Text</option>
              <option value="select">Dropdown</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(field.tempId, { required: e.target.checked })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => removeField(field.tempId)}
              className="text-red-400 hover:text-red-600 text-lg font-bold shrink-0"
              title="Remove field"
            >
              &times;
            </button>
          </div>

          {field.fieldType === "select" && (
            <div className="pl-8 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Dropdown Options</p>
              {parseOptions(field.options).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const opts = parseOptions(field.options);
                      opts[i] = e.target.value;
                      updateField(field.tempId, { options: buildOptions(opts, hasOtherFlag(field.options)) });
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const opts = parseOptions(field.options);
                      opts.splice(i, 1);
                      updateField(field.tempId, { options: buildOptions(opts, hasOtherFlag(field.options)) });
                    }}
                    className="text-red-400 hover:text-red-600 text-lg font-bold shrink-0"
                    title="Remove option"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const opts = parseOptions(field.options);
                  opts.push("");
                  updateField(field.tempId, { options: buildOptions(opts, hasOtherFlag(field.options)) });
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add Option
              </button>
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={hasOtherFlag(field.options)}
                  onChange={(e) => {
                    const opts = parseOptions(field.options);
                    updateField(field.tempId, { options: buildOptions(opts, e.target.checked) });
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Allow &quot;Other&quot; (free text input)
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
