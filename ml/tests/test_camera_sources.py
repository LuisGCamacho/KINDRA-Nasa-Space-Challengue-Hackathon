"""Pruebas de la importación de cámaras de Caltrans, sin conexión a internet."""

from kindra.vision.camera_sources import camera_from_caltrans, refresh_seconds

IMAGE = "https://cwwp2.dot.ca.gov/data/d2/cctv/image/abramslakenb/abramslakenb.jpg"


def caltrans_item(in_service="true", image=IMAGE, lat="41.34496"):
    return {
        "inService": in_service,
        "location": {"locationName": "Abrams Lake NB", "route": "I-5", "county": "Siskiyou",
                     "longitude": "-122.34276", "latitude": lat},
        "imageData": {"streamingVideoURL": "", "static": {"currentImageURL": image,
                                                          "currentImageUpdateFrequency": "5"}},
    }


def test_camara_de_caltrans_sale_con_el_contrato():
    camera, county = camera_from_caltrans(caltrans_item(), district=2)
    assert county == "Siskiyou"
    assert camera == {
        "id": "caltrans-d2-abramslakenb",
        "name": "Abrams Lake NB · I-5 · Siskiyou",
        "provider": "caltrans",
        "position": [-122.34276, 41.34496],  # [lon, lat]
        "imageUrl": IMAGE,
        "videoUrl": None,
        "refreshSeconds": 300,
        "attribution": camera["attribution"],
        "termsUrl": "https://dot.ca.gov/conditions-of-use",
    }
    assert "Caltrans" in camera["attribution"]


def test_se_saltan_camaras_fuera_de_servicio_o_incompletas():
    assert camera_from_caltrans(caltrans_item(in_service="false"), 2)[0] is None
    assert camera_from_caltrans(caltrans_item(image=""), 2)[0] is None
    assert camera_from_caltrans(caltrans_item(lat=""), 2)[0] is None


def test_frecuencia_en_minutos_pasa_a_segundos():
    assert refresh_seconds("60") == 3600
    assert refresh_seconds("") == 300  # sin dato: la frecuencia más común de Caltrans


def test_imagenes_anteriores_de_caltrans():
    from kindra.vision.cameras import previous_image_urls

    camera = {"provider": "caltrans", "imageUrl": IMAGE}
    assert previous_image_urls(camera, 2) == [
        "https://cwwp2.dot.ca.gov/data/d2/cctv/image/abramslakenb/previous/abramslakenb-1.jpg",
        "https://cwwp2.dot.ca.gov/data/d2/cctv/image/abramslakenb/previous/abramslakenb-2.jpg",
    ]
    assert len(previous_image_urls(camera, 50)) == 12  # Caltrans guarda solo 12
    assert previous_image_urls({"provider": "demo", "imageUrl": IMAGE}, 3) == []
