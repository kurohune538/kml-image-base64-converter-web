function ErrorAlert({ error }: { error: string | null }) {
    return error ? (
      <div className="mt-4 p-2 text-red-700 bg-red-100 rounded">{error}</div>
    ) : null;
}

export default ErrorAlert;
