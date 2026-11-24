"""Echo cloud-art cutout. Uses installed weights; never downloads or generates an image."""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--input')
    parser.add_argument('--output')
    args = parser.parse_args()
    if not Path(args.model).is_file():
        raise RuntimeError('The installed background-removal model is missing.')

    from PIL import Image
    import numpy as np
    from transparent_background import Remover
    from pymatting import estimate_foreground_ml  # Required for fringe-color cleanup.

    if args.check:
        return
    if not args.input or not args.output:
        parser.error('--input and --output are required unless checking dependencies')

    with Image.open(args.input) as image:
        if image.width * image.height > 25_000_000:
            raise RuntimeError('Echo artwork is too large.')
        image.thumbnail((1536, 1536))
        # An old color-keyed render can have transparent corners but still a dark halo.
        # Composite those corners against their original matte for consistent segmentation.
        rgba = image.convert('RGBA')
        pixels = np.asarray(rgba)
        border = np.concatenate((pixels[0], pixels[-1], pixels[:, 0], pixels[:, -1]))
        opaque = border[border[:, 3] > 250, :3]
        matte = tuple(int(x) for x in np.median(opaque, axis=0)) if len(opaque) else (0, 0, 0)
        source = Image.new('RGBA', rgba.size, (*matte, 255))
        source.alpha_composite(rgba)

    remover = Remover(mode='base', jit=False, ckpt=args.model)
    # Soft alpha and foreground estimation avoid the hard white outline of a thresholded mask.
    remover.matting_fn = estimate_foreground_ml
    cutout = remover.process(source.convert('RGB'), type='rgba')
    alpha = np.asarray(cutout.getchannel('A'))
    if np.count_nonzero(alpha >= 128) < alpha.size * 0.001:
        raise RuntimeError('Background removal could not find a solid creature. Original artwork retained.')
    if np.count_nonzero(alpha < 128) < alpha.size * 0.001:
        raise RuntimeError('Background removal could not separate the background. Original artwork retained.')
    cutout.save(args.output, format='PNG')


if __name__ == '__main__':
    main()
