'use client';

import { useState } from 'react';
import Form from '@/components/ui/form';
import ErrorAlert from '@/components/ui/error';
export default function HomePage() {
  const [state, setState] = useState({
    kmlFile: null as File | null,
    csvFile: null as File | null,
    images: [] as File[],
    csvImages: [] as File[],
    columnName: '',
    processedCsv: null as string | null,
    resultCzml: null as string | null,
    error: null as string | null,
  });
  
  const handleStateChange = <T extends keyof typeof state>(key: T, value: typeof state[T]) => {
    setState((prevState) => ({ ...prevState, [key]: value }));
  };

  // const validateFile = (file: File, allowedTypes: string[]): boolean => {
  //   return allowedTypes.includes(file.type);
  // };

  // ファイル配列を更新する関数
  const handleFileArrayChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof typeof state) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleStateChange(key, files);
  };

  const handleFileChangeWithValidation = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: keyof typeof state,
    allowedTypes: string[],
    errorMessage: string
  ) => {
    const file = e.target.files?.[0];
    // if (file && validateFile(file, allowedTypes)) {
    if (file) {
      handleStateChange(key, file);
    } else {
      alert(errorMessage);
    }
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.csvFile || state.csvImages.length === 0 || !state.columnName) {
      alert("CSVファイル、画像、およびカラム名を指定してください。");
      return;
    }

    const formData = new FormData();
    formData.append('csv', state.csvFile);
    state.csvImages.forEach((img) => formData.append('images', img));
    formData.append('columnName', state.columnName);

    try {
      const res = await fetch('/api/processCsv', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorMessage = await res.text();
        alert(`エラー: ${errorMessage}`);
        return;
      }

      const data = await res.blob();
      const fileUrl = URL.createObjectURL(data);
      handleStateChange("processedCsv",fileUrl);
    } catch (error) {
      console.error("CSV処理中にエラーが発生しました:", error);
    }
  };

  const handleCsvDownload = () => {
    if (state.processedCsv) {
      const link = document.createElement('a');
      link.href = state.processedCsv;
      link.download = 'processed_data.csv';
      link.click();
      URL.revokeObjectURL(state.processedCsv); // メモリ解放
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleStateChange("error", null); // 新しい送信時に前回のエラーをクリア

    const formData = new FormData();
    if (state.kmlFile) formData.append('kml', state.kmlFile);
    state.images.forEach((img) => formData.append('images', img));

    try {
      const res = await fetch('/api/convertKml', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.message || "Unknown error occurred.";
        handleStateChange("error", `Error ${res.status}: ${errorMessage}`);
        console.error("Error in API response", res.status, errorMessage);
        return;
      }

      const data = await res.json();
      handleStateChange("resultCzml", data);
      console.log("Received CZML data:", data);
    } catch (error) {
      handleStateChange("error", "エラーが発生しました。" + error);
      console.error("Error fetching CZML data:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(state.resultCzml, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'converted_data.czml';
    link.click();
    URL.revokeObjectURL(url);  // メモリ解放
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <Form
        title="KML to CZML Converter"
        fields={[
          { label: "KML File", type: "file", accept: ".kml", onChange: (e) =>
            handleFileChangeWithValidation(
              e,
              "kmlFile",
              ["application/vnd.google-earth.kml+xml"],
              "Select valid Kml file"
            ),
          },
          { label: "Images", type: "file", accept: "image/*", multiple: true, onChange: (e) => handleFileArrayChange(e, "images")},
        ]}
        onSubmit={handleSubmit}
        submitText="Convert"
        result={state.resultCzml}
        onDownload={handleDownload}
      />

      <Form
        title="CSV Processor with Base64 Images"
        fields={[
          {
            label: "CSV File",
            type: "file",
            accept: ".csv",
            onChange: (e) =>
              handleFileChangeWithValidation(
                e,
                "csvFile",
                ["text/csv"],
                "Select valid CSV file" // CSV専用のエラーメッセージ
              ),
          },
          {
            label: "Images",
            type: "file",
            accept: "image/*",
            multiple: true,
            onChange: (e) => handleFileArrayChange(e, "csvImages"), // 複数ファイル対応
          },
          {
            label: "Matching Column Name",
            type: "text",
            placeholder: "Enter column name for matching",
            onChange: (e) => handleStateChange("columnName", e.target.value), // 単一値の更新
          },
        ]}
        onSubmit={handleCsvSubmit}
        submitText="Process CSV"
        result={state.processedCsv}
        onDownload={handleCsvDownload}
      />
      <ErrorAlert error={state.error} />
    </div>
  );
}
