import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';
import { Buffer } from 'buffer';
import { formatIso8601 } from "../../../lib/utils";

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
interface KMLDocument {
    kml?: {
        Document?: Array<{
            GroundOverlay?: GroundOverlay[];
            Folder?: Array<{
                GroundOverlay?: GroundOverlay[];
            }>;
        }>;
    };
    Folder?: {
        GroundOverlay?: GroundOverlay[];
    };
}
function findGroundOverlays(kmlData: KMLDocument): GroundOverlay[] {
    // Document形式のKMLを確認
    if (kmlData.kml?.Document?.[0]?.GroundOverlay) {
        console.log("Found Document-style KML structure");
        return kmlData.kml.Document[0].GroundOverlay;
    }
    
    // Folder形式のKMLを確認
    if (kmlData.Folder?.GroundOverlay) {
        console.log("Found Folder-style KML structure");
        return kmlData.Folder.GroundOverlay;
    }
    
    // Document > Folder形式のKMLを確認
    if (kmlData.kml?.Document?.[0]?.Folder?.[0]?.GroundOverlay) {
        console.log("Found Document>Folder-style KML structure");
        return kmlData.kml.Document[0].Folder[0].GroundOverlay;
    }

    console.warn("No recognized KML structure found");
    return [];
}

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
    
    // 異なるKML構造に対応した GroundOverlay の取得
    const groundOverlays = findGroundOverlays(kmlData);
    console.log(`Found ${groundOverlays.length} GroundOverlay elements.`);

    if (groundOverlays.length === 0) {
        throw new Error('No GroundOverlay elements found in the KML file');
    }

    // 各GroundOverlayの時間情報を収集
    const timeIntervals = groundOverlays.map((overlay: GroundOverlay) => {
        const timeSpan = overlay.TimeSpan && overlay.TimeSpan[0];
        const begin = timeSpan?.begin && timeSpan.begin[0];
        const timeStamp = overlay.TimeStamp && overlay.TimeStamp[0]?.when[0];
        return formatIso8601(timeStamp || begin || "2000-01-01T00:00:00Z");
    });

    // 各エンティティの処理
    for (let i = 0; i < groundOverlays.length; i++) {
        const overlay = groundOverlays[i];
        const name = overlay.name ? (typeof overlay.name[0] === 'string' ? overlay.name[0] : overlay.name[0]._) : `Overlay ${overlayIndex}`;
        console.log(`Processing GroundOverlay: ${name}`);

        const latLonBox: LatLonBox = {
            north: parseFloat(overlay.LatLonBox[0].north[0]),
            south: parseFloat(overlay.LatLonBox[0].south[0]),
            east: parseFloat(overlay.LatLonBox[0].east[0]),
            west: parseFloat(overlay.LatLonBox[0].west[0])
        };

       // アイコン画像の処理
       let imageData = null;
       if (overlay.Icon && overlay.Icon[0].href) {
           const imageFileNameWithPath = overlay.Icon[0].href[0];
           const imageFileName = imageFileNameWithPath.split('/').pop(); // Extract the file name from the path
           if (imageFileName && uploadedImages[imageFileName]) {
            const imgBuffer = uploadedImages[imageFileName];
            console.log(`Encoding image: ${imageFileName}`);
            imageData = `data:image/png;base64,${imgBuffer.toString('base64')}`;
           } else {
            console.warn(`Image file ${imageFileName} not found. Using default image.`);
            imageData = "data:image/png;base64,DEFAULT_IMAGE_BASE64"; // Replace with actual base64 of a default image
           }
       } else {
           console.warn(`No image reference found for overlay: ${name}. Using default image.`);
           imageData = "data:image/png;base64,DEFAULT_IMAGE_BASE64"; // Replace with actual base64 of a default image
       }

        // 時間範囲の設定
        const timeSpan = overlay.TimeSpan && overlay.TimeSpan[0];
        const begin = timeIntervals[i];
        let end: string | null = null;
        if (i < groundOverlays.length - 1) {
            // Use the next overlay's time as the end time, if available
            end = timeSpan?.end?.[0] || timeIntervals[i + 1];
        } else {
            // For the last overlay, keep the end time undefined for an open-ended interval
            end = timeSpan?.end?.[0] || null;
        }
        const availability = end ? `${begin}/${end}` : `${begin}/${begin}`;
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
                        image: imageData || "default_image.png",
                        repeat: [1, 1]
                    },
                    color: {
                        rgba: [255, 255, 255, 255] // デフォルトは不透明
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

export async function POST(req: Request) {
    console.log("Received request for KML to CZML conversion.");
    try {
        const formData = await req.formData();
        console.log("FormData parsed.");

        const kmlFile = formData.get('kml') as File;
        const images = formData.getAll('images') as File[];

        if (!kmlFile) {
            throw new Error('KML file is required');
        }

        const kmlContent = await kmlFile.text();
        console.log("KML file content loaded.");

        const uploadedImages: { [key: string]: Buffer } = {};
        for (const imgFile of images) {
            const arrayBuffer = await imgFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            uploadedImages[imgFile.name] = buffer;
            console.log(`Loaded image: ${imgFile.name}`);
        }

        const czmlData = await parseKmlToCzmlWithOverlay(kmlContent, uploadedImages);
        return NextResponse.json(czmlData);
    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process KML conversion' },
            { status: 500 }
        );
    }
}