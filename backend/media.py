"""Validate uploaded pixels and safely fetch public image URLs for indexing."""
import io
import ipaddress
import socket
import time
import warnings
from urllib.parse import urlparse, urljoin

import urllib3
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 15 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


def decode_image(data):
    if not data or len(data) > MAX_BYTES:
        raise ValueError('Images must be smaller than 15 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP', 'GIF'):
                    raise ValueError('Use a JPEG, PNG, WebP, or GIF image.')
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((2048, 2048))
                return image
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise ValueError('This file is not a supported image, or its dimensions are too large.') from exc


def fetch_image(url):
    """Pin the connection to a validated public IP, including each redirect.

    Checking DNS and then fetching the hostname again would allow DNS rebinding.
    HTTPS still verifies the original hostname and sends it as TLS SNI.
    """
    deadline = time.monotonic() + 30
    for _ in range(4):
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Use a public http or https image URL.')
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        if port not in (80, 443):
            raise ValueError('Image URLs must use standard web ports.')
        addresses = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
            raise ValueError('Only public image URLs can be indexed. Upload local images instead.')
        ip = addresses[0][4][0]
        timeout = urllib3.Timeout(connect=5, read=5, total=15)
        if parsed.scheme == 'https':
            pool = urllib3.HTTPSConnectionPool(ip, port, timeout=timeout,
                assert_hostname=parsed.hostname, server_hostname=parsed.hostname)
        else:
            pool = urllib3.HTTPConnectionPool(ip, port, timeout=timeout)
        try:
            response = pool.request('GET', parsed.path + ('?' + parsed.query if parsed.query else ''),
                headers={'Host': parsed.netloc, 'User-Agent': 'ImageShare/1.0'},
                preload_content=False, redirect=False, retries=False)
            try:
                if response.status in (301, 302, 303, 307, 308):
                    url = urljoin(url, response.headers.get('Location', ''))
                    continue
                if response.status != 200:
                    raise ValueError('The source website did not allow this image to be downloaded. Try uploading it.')
                data = bytearray()
                for chunk in response.stream(64 * 1024):
                    data.extend(chunk)
                    if len(data) > MAX_BYTES or time.monotonic() > deadline:
                        raise ValueError('The image is too large or took too long to download.')
                return decode_image(bytes(data))
            finally:
                response.close()
        finally:
            pool.close()
    raise ValueError('The image URL redirects too many times.')
