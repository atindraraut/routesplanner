import * as Jimp from 'jimp';
import { ExifImage } from 'exif';
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as path from 'path';
import {mkdir} from 'node:fs/promises';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface ImageMetadata extends Coordinates {
  fileName: string;
}

async function generateRandomImages(
  numImages: number,
  from: Coordinates,
  to: Coordinates
) {
  const outputDir = 'test-images';

  try {
    console.log(`Creating directory: ${outputDir}`);
    await mkdir(outputDir, { recursive: true });
    console.log('Directory created successfully.');
  } catch (error) {
      if (error instanceof Error) {
        console.error(`Error creating directory: ${error.message}`);
      } else {
        console.error(`An unexpected error occurred: ${error}`);
      }
    return;
  }
  console.log(`Generating ${numImages} images...`);

  for (let i = 0; i < numImages; i++) {
    const fileName = `image-${i + 1}.jpg`;
    const filePath = path.join(outputDir, fileName);

    try {
      const randomCoords = getRandomCoordinates(from, to);
      const metadata: ImageMetadata = {
        ...randomCoords,
        fileName: fileName,
      };

      console.log(`Generating image ${i + 1} of ${numImages}...`);
      await createPlaceholderImage(filePath, metadata);
      console.log(`Image ${i + 1} created at ${filePath}`);
    } catch (error) {
        if (error instanceof Error) {
          console.error(`Error generating image ${i + 1}: ${error.message}`);
        } else {
          console.error(`An unexpected error occurred: ${error}`);
        }
      return;
    }
  }

  console.log(`Successfully generated ${numImages} images in ${outputDir}`);
}

function getRandomCoordinates(from: Coordinates, to: Coordinates): Coordinates {
  const latitude = getRandomArbitrary(from.latitude, to.latitude);
  const longitude = getRandomArbitrary(from.longitude, to.longitude);
  return { latitude, longitude };
}

function getRandomArbitrary(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function createPlaceholderImage(
  filePath: string,
  metadata: ImageMetadata
): Promise<void> {
  try {
    const image = await Jimp.create(500, 500, 'white');
    await image.writeAsync(filePath);

    const exifData = {
      GPSLatitudeRef: metadata.latitude > 0 ? 'N' : 'S',
      GPSLatitude: convertToDMS(Math.abs(metadata.latitude)),
      GPSLongitudeRef: metadata.longitude > 0 ? 'E' : 'W',
      GPSLongitude: convertToDMS(Math.abs(metadata.longitude)),
    };

    new ExifImage({ image: filePath }, function (error, exifData) {
      if (error) {
        console.error('Error: ' + error.message);
      } else {
        const oldExif = { ...exifData };
        oldExif.gps = {
          GPSLatitudeRef: metadata.latitude > 0 ? 'N' : 'S',
          GPSLatitude: convertToDMS(Math.abs(metadata.latitude)),
          GPSLongitudeRef: metadata.longitude > 0 ? 'E' : 'W',
          GPSLongitude: convertToDMS(Math.abs(metadata.longitude)),
        };
        new Jimp(filePath, (err, image) => {
          if(err){
            console.error("Error on Jimp", err)
          }
          image.exif = oldExif;
          image.write(filePath)
        });
      }
    });

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error creating placeholder image: ${error.message}`);
    } else {
      throw new Error(`An unexpected error occurred: ${error}`);
    }
  }
}

function convertToDMS(decimal: number): number[] {
  const degrees = Math.floor(decimal);
  const minutesDecimal = (decimal - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.round((minutesDecimal - minutes) * 60);
  return [degrees, minutes, seconds];
}

const argv = yargs(hideBin(process.argv))
  .option('numImages', {
    alias: 'n',
    description: 'Number of images to generate',
    type: 'number',
    demandOption: true,
  })
  .option('fromLat', {
    description: 'Starting latitude',
    type: 'number',
    demandOption: true,
  })
  .option('fromLon', {
    description: 'Starting longitude',
    type: 'number',
    demandOption: true,
  })
  .option('toLat', {
    description: 'Ending latitude',
    type: 'number',
    demandOption: true,
  })
  .option('toLon', {
    description: 'Ending longitude',
    type: 'number',
    demandOption: true,
  })
  .parseSync();

generateRandomImages(
  argv.numImages,
  { latitude: argv.fromLat, longitude: argv.fromLon },
  { latitude: argv.toLat, longitude: argv.toLon }
);