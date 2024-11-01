'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [resultCzml, setResultCzml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // エラーメッセージの状態

  const handleKmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setKmlFile(e.target.files[0]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // 新しい送信時に前回のエラーをクリア

    const formData = new FormData();
    if (kmlFile) formData.append('kml', kmlFile);
    images.forEach((img) => formData.append('images', img));

    try {
      const res = await fetch('/api/convertKml', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.message || "Unknown error occurred.";
        setError(`Error ${res.status}: ${errorMessage}`);
        console.error("Error in API response", res.status, errorMessage);
        return;
      }

      const data = await res.json();
      setResultCzml(data);
      console.log("Received CZML data:", data);
    } catch (error) {
      setError("エラーが発生しました。" + error);
      console.error("Error fetching CZML data:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(resultCzml, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'converted_data.czml';
    link.click();
    URL.revokeObjectURL(url);  // メモリ解放
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-center mb-6">KML to CZML Converter</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KML File</label>
            <Input type="file" accept=".kml" onChange={handleKmlChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
            <Input type="file" accept="image/*" multiple onChange={handleImageChange} />
          </div>
          <Button type="submit" className="w-full">Convert</Button>
        </form>
        {error && (
          <div className="mt-4 p-2 text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}
        {resultCzml && (
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-2">Converted CZML Data</h2>
            <Button onClick={handleDownload} className="w-full">Download CZML Data</Button>
          </div>
        )}
      </div>
    </div>
  );
}