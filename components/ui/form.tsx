import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormProps = {
    title: string;
    fields: { label: string; type: string; accept?: string; placeholder?: string; multiple?: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }[];
    onSubmit: (e: React.FormEvent) => void;
    submitText: string;
    result?: string | null;
    onDownload?: () => void;
};
  
function Form({ title, fields, onSubmit, submitText, result, onDownload }: FormProps) {
    return (
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-center mb-6">{title}</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {fields.map((field, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <Input type={field.type} accept={field.accept} multiple={field.multiple} onChange={field.onChange} />
            </div>
          ))}
          <Button type="submit" className="w-full">
            {submitText}
          </Button>
        </form>
        {result && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Result</h2>
            {onDownload && <Button onClick={onDownload} className="w-full">Download</Button>}
          </div>
        )}
      </div>
    );
}

export default Form;