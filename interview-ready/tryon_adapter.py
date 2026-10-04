"""Unactivated server integration seam for FASHN, not a public upload endpoint.
The approved MissionMed gateway must supply authentication, request authorization,
per-user rate/budget limits and the credential. This module never reads env/files or logs.
No network is performed unless an authorized host supplies a transport and credential.
Primary contract checked 2026-10-04: docs.fashn.ai/api-reference/tryon-v1-6.
"""
import base64,io,re,time
from PIL import Image,ImageOps

class TryOnError(ValueError):pass

def sanitize_image(data_uri):
    if not isinstance(data_uri,str) or len(data_uri)>14_000_000:raise TryOnError('Image size exceeds the limit.')
    m=re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)',data_uri)
    if not m:raise TryOnError('A local image data URI is required; external URLs are rejected.')
    try:
        raw=base64.b64decode(m[2],validate=True)
        if len(raw)>10*1024*1024:raise TryOnError('Image size exceeds the limit.')
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ('JPEG','PNG','WEBP') or source.width*source.height>20_000_000:raise TryOnError('Unsupported image.')
            source.load();image=ImageOps.exif_transpose(source).convert('RGB');image.thumbnail((1600,2000))
            output=io.BytesIO();image.save(output,'JPEG',quality=90)
        return 'data:image/jpeg;base64,'+base64.b64encode(output.getvalue()).decode()
    except TryOnError:raise
    except Exception:raise TryOnError('Could not decode the image.') from None

class FashnAdapter:
    def __init__(self,*,credential,transport,approved_gateway=False,sleeper=time.sleep):
        if not approved_gateway:raise TryOnError('Approved MissionMed server-side FASHN gateway has not been provisioned.')
        if not credential or not callable(transport):raise TryOnError('Server configuration is incomplete.')
        self.__credential=credential;self.__transport=transport;self.__sleep=sleeper

    def visualize(self,person,garment,*,consent=False,cost_acknowledged=False,category='tops',cancelled=lambda:False):
        if not consent or not cost_acknowledged:raise TryOnError('Explicit destination, retention and one-credit cost consent is required.')
        if category not in ('tops','bottoms','one-pieces'):raise TryOnError('Select a supported garment category.')
        if cancelled():raise TryOnError('Request cancelled before submission.')
        body={'model_name':'tryon-v1.6','inputs':{'model_image':sanitize_image(person),'garment_image':sanitize_image(garment),'category':category,'num_samples':1,'return_base64':True,'output_format':'jpeg','moderation_level':'conservative','mode':'quality'}}
        headers={'Authorization':'Bearer '+self.__credential,'Content-Type':'application/json'}
        try:
            reply=self.__transport('POST','https://api.fashn.ai/v1/run',headers,body)
            # No retry of POST: unknown success must not cause duplicate spend.
            prediction=reply.get('id')
            if not isinstance(prediction,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',prediction):raise TryOnError('Provider did not return a valid prediction.')
            for attempt in range(30):
                if cancelled():raise TryOnError('Polling stopped. A submitted provider job may still complete and consume one credit.')
                status=self.__transport('GET','https://api.fashn.ai/v1/status/'+prediction,headers,None)
                state=status.get('status')
                if state=='completed':
                    output=status.get('output',[])
                    if len(output)!=1:raise TryOnError('Unexpected provider output.')
                    # Disallow remote output URLs and strip all metadata from returned bytes.
                    return {'image':sanitize_image(output[0]),'model':'tryon-v1.6','fitPrediction':False,'credits':1}
                if state=='failed':raise TryOnError('Provider could not produce a visualization. Try a clearer garment/photo after reviewing the cause.')
                if state not in ('starting','in_queue','processing'):raise TryOnError('Unexpected provider state.')
                self.__sleep(2)
            raise TryOnError('Provider status timed out. Do not resubmit automatically; the original job may still finish.')
        except TryOnError:raise
        except Exception:raise TryOnError('Provider request failed. No automatic paid retry was attempted.') from None
        finally:
            body.clear();headers.clear()
