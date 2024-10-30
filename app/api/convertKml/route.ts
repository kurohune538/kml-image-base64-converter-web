import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';
import { Buffer } from 'buffer';

interface LatLonBox {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface CZMLMetadata {
    id: string;
    name: string;
    version: string;
}


interface CZMLOverlayEntity {
    id: string;
    name: string;
    availability: string;
    rectangle: {
        coordinates: {
            wsenDegrees: number[];
        };
        material: {
            image: {
                image: string;
                repeat: number[];
            };
        };
    };
}
interface GroundOverlay {
    name?: [{ _: string }];
    LatLonBox: [{
        north: [string];
        south: [string];
        east: [string];
        west: [string];
    }];
    Icon?: [{
        href: [string];
    }];
    TimeStamp?: [{ when: string }];
    TimeSpan?: [{ begin?: string; end?: string }];
}

// ISO 8601形式を整える関数
function formatIso8601(dateString: string): string {
    return dateString.includes("T") ? dateString : dateString.replace(/(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})/, "$1T$2Z");
}

// KMLファイルをCZMLに変換する関数
async function parseKmlToCzmlWithOverlay(kmlContent: string, uploadedImages: { [key: string]: Buffer }) {
    console.log("Starting KML to CZML conversion...");
    const kmlData = await parseStringPromise(kmlContent);
    console.log("KML parsed successfully.");

    const czml: Array<CZMLMetadata | CZMLOverlayEntity> = [{
        id: "document",
        name: "KML to CZML Conversion with Image Overlay",
        version: "1.0"
    }];

    let overlayIndex = 1;
    const groundOverlays = kmlData.kml.Document[0].GroundOverlay || [];
    console.log(`Found ${groundOverlays.length} GroundOverlay elements.`);

    // 各GroundOverlayの時間情報を収集
    const timeIntervals = groundOverlays.map((overlay: GroundOverlay) => {
        const timeStamp = overlay.TimeStamp && overlay.TimeStamp[0]?.when[0];
        const timeSpanBegin = overlay.TimeSpan && overlay.TimeSpan[0]?.begin;
        console.log("timestamp: ",timeStamp);
        return formatIso8601(timeStamp || timeSpanBegin || "2000-01-01T00:00:00Z");
    });

    // 各エンティティのavailabilityを次のエンティティの時間範囲まで設定
    for (let i = 0; i < groundOverlays.length; i++) {
        const overlay = groundOverlays[i];
        const name = overlay.name ? overlay.name[0] : `Overlay ${overlayIndex}`;
        console.log(`Processing GroundOverlay: ${name}`);

        const latLonBox: LatLonBox = {
            north: parseFloat(overlay.LatLonBox[0].north[0]),
            south: parseFloat(overlay.LatLonBox[0].south[0]),
            east: parseFloat(overlay.LatLonBox[0].east[0]),
            west: parseFloat(overlay.LatLonBox[0].west[0])
        };

        // アイコン画像のパスを取得し、Base64エンコード
        let imageData = null;
        if (overlay.Icon && overlay.Icon[0].href) {
            const imageFileName = overlay.Icon[0].href[0];
            const imgBuffer = uploadedImages[imageFileName];
            if (imgBuffer) {
                console.log(`Encoding image: ${imageFileName}`);
                imageData = `data:image/png;base64,${imgBuffer.toString('base64')}`;
            } else {
                console.error(`Image file ${imageFileName} not found.`);
            }
        }

        // 各エンティティのavailabilityを次のエンティティの時間範囲まで設定
        const begin = timeIntervals[i];
        const end = timeIntervals[i + 1] || "2100-01-01T00:00:00Z";  // 次の時間がない場合はデフォルトの終了時間
        const availability = `${begin}/${end}`;

        const czmlOverlay = {
            id: `overlay_${overlayIndex}`,
            name: name,
            availability: availability,
            rectangle: {
                coordinates: {
                    wsenDegrees: [latLonBox.west, latLonBox.south, latLonBox.east, latLonBox.north]
                },
                material: {
                    image: {
                        image: imageData || "default_image.png",  // 画像が見つからない場合はデフォルト
                        repeat: [1, 1]
                    }
                }
            }
        };
        czml.push(czmlOverlay);
        overlayIndex += 1;
    }

    console.log("KML to CZML conversion completed successfully.");
    return czml;
}

// API Route
export async function POST(req: Request) {
    console.log("Received request for KML to CZML conversion.");
    const formData = await req.formData();
    console.log("FormData parsed.");

    const kmlFile = formData.get('kml') as File;
    const images = formData.getAll('images') as File[];

    // KMLファイル内容の読み込み
    const kmlContent = await kmlFile.text();
    console.log("KML file content loaded.");

    // 画像の読み込みとBase64エンコード
    const uploadedImages: { [key: string]: Buffer } = {};
    for (const imgFile of images) {
        const arrayBuffer = await imgFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        uploadedImages[imgFile.name] = buffer;
        console.log(`Loaded image: ${imgFile.name}`);
    }

    // KMLからCZMLへの変換
    const czmlData = await parseKmlToCzmlWithOverlay(kmlContent, uploadedImages);

    console.log("Returning CZML data as JSON.");
    return NextResponse.json(czmlData);
}