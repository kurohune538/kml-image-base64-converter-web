import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// CSVの指定カラムに基づき、image_urlカラムを生成して画像を埋め込む関数
async function embedImagesByColumn(
  csvContent: string,
  uploadedImages: { [key: string]: Buffer },
  columnName: string
): Promise<string> {
  // CSVを解析
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  if (!records.length) {
    throw new Error('CSV file is empty or invalid.');
  }

  // 指定カラムが存在しない場合はエラー
  if (!Object.keys(records[0]).includes(columnName)) {
    throw new Error(`Column "${columnName}" does not exist in the CSV file.`);
  }

  // `image_url`カラムを生成し、各行に対応する画像を埋め込む
  console.log(uploadedImages);
  for (const record of records) {
    const matchingValue = record[columnName]?.trim(); // 指定カラムの値
    const imageFileName = Object.keys(uploadedImages).find((imgName) =>
      imgName.startsWith(matchingValue)
    ); // 指定カラム値に対応する画像を検索
    if (imageFileName && uploadedImages[imageFileName]) {
      const imageBuffer = uploadedImages[imageFileName];
      record['image_url'] = `data:image/png;base64,${imageBuffer.toString('base64')}`; // Base64エンコード
    } else {
      console.warn(`No matching image for value "${matchingValue}".`);
      record['image_url'] = ''; // 画像が見つからない場合は空欄
    }
  }

  // CSVを文字列として生成
  const outputCsv = stringify(records, { header: true });
  return outputCsv;
}

export async function POST(req: Request) {
  console.log('Received request for CSV processing.');
  try {
    const formData = await req.formData();
    console.log('FormData parsed.');

    const csvFile = formData.get('csv') as File;
    const images = formData.getAll('images') as File[];
    const columnName = formData.get('columnName') as string;

    if (!csvFile) {
      throw new Error('CSV file is required');
    }
    if (!columnName) {
      throw new Error('Column name is required');
    }

    const csvContent = await csvFile.text();
    console.log('CSV file content loaded.');

    const uploadedImages: { [key: string]: Buffer } = {};
    for (const imgFile of images) {
      const arrayBuffer = await imgFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      uploadedImages[imgFile.name] = buffer;
      console.log(`Loaded image: ${imgFile.name}`);
    }

    const csvData = await embedImagesByColumn(csvContent, uploadedImages, columnName);
    console.log('CSV processing completed successfully.');

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=processed_data.csv',
      },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process CSV' },
      { status: 500 }
    );
  }
}