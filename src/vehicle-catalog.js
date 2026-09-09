// Autologika vehicle catalog.
// Celowo trzymany jako osobny moduł, aby można go było później zastąpić
// importem z licencjonowanej bazy (np. TecDoc) bez przebudowy formularza.

const Y=(from,to=new Date().getFullYear())=>Array.from({length:Math.max(0,to-from+1)},(_,i)=>String(to-i))
const E=(...items)=>items

export const vehicleCatalog={
  'Audi':{
    'A1':{years:Y(2010),engines:E('1.0 TFSI','1.2 TFSI','1.4 TFSI','1.5 TFSI','1.6 TDI','2.0 TFSI')},
    'A3':{years:Y(1996),engines:E('1.0 TFSI','1.2 TFSI','1.4 TFSI','1.5 TFSI','1.6 TDI','1.8 TFSI','1.9 TDI','2.0 TDI','2.0 TFSI','S3 2.0 TFSI','RS3 2.5 TFSI')},
    'A4':{years:Y(1994),engines:E('1.4 TFSI','1.6','1.8T','1.8 TFSI','1.9 TDI','2.0 TDI','2.0 TFSI','2.5 TDI','2.7 TDI','3.0 TDI','3.0 TFSI','S4','RS4')},
    'A5':{years:Y(2007),engines:E('1.8 TFSI','2.0 TDI','2.0 TFSI','2.7 TDI','3.0 TDI','3.0 TFSI','S5','RS5')},
    'A6':{years:Y(1994),engines:E('1.8T','1.8 TFSI','1.9 TDI','2.0 TDI','2.0 TFSI','2.5 TDI','2.7 TDI','2.7 TFSI','3.0 TDI','3.0 TFSI','4.0 TFSI','S6','RS6')},
    'A7':{years:Y(2010),engines:E('2.0 TDI','2.0 TFSI','3.0 TDI','3.0 TFSI','S7','RS7')},
    'A8':{years:Y(1994),engines:E('2.8 FSI','3.0 TDI','3.0 TFSI','4.0 TDI','4.0 TFSI','4.2 FSI','4.2 TDI','6.0 W12','S8')},
    'Q2':{years:Y(2016),engines:E('1.0 TFSI','1.4 TFSI','1.5 TFSI','1.6 TDI','2.0 TDI','2.0 TFSI')},
    'Q3':{years:Y(2011),engines:E('1.4 TFSI','1.5 TFSI','2.0 TDI','2.0 TFSI','RS Q3 2.5 TFSI')},
    'Q5':{years:Y(2008),engines:E('2.0 TDI','2.0 TFSI','3.0 TDI','3.0 TFSI','SQ5')},
    'Q7':{years:Y(2005),engines:E('2.0 TFSI','3.0 TDI','3.0 TFSI','4.2 TDI','4.2 FSI','SQ7')},
    'Q8':{years:Y(2018),engines:E('3.0 TDI','3.0 TFSI','4.0 TFSI','SQ8','RS Q8')},
    'TT':{years:Y(1998),engines:E('1.8T','1.8 TFSI','2.0 TDI','2.0 TFSI','TTS','TT RS 2.5 TFSI')}
  },
  'BMW':{
    'Seria 1':{years:Y(2004),engines:E('116i','118i','120i','125i','M135i','M140i','116d','118d','120d','123d','125d')},
    'Seria 2':{years:Y(2014),engines:E('218i','220i','228i','230i','M235i','M240i','216d','218d','220d','225d')},
    'Seria 3':{years:Y(1982),engines:E('316i','318i','320i','323i','325i','328i','330i','335i','340i','M3','316d','318d','320d','325d','330d','335d')},
    'Seria 4':{years:Y(2013),engines:E('418i','420i','428i','430i','435i','440i','M4','418d','420d','425d','430d','435d')},
    'Seria 5':{years:Y(1981),engines:E('518i','520i','523i','525i','528i','530i','535i','540i','550i','M5','518d','520d','525d','530d','535d','540d')},
    'Seria 6':{years:Y(1976),engines:E('630i','640i','650i','M6','630d','640d')},
    'Seria 7':{years:Y(1977),engines:E('728i','730i','735i','740i','745i','750i','760i','730d','740d','745d','750d')},
    'X1':{years:Y(2009),engines:E('sDrive18i','xDrive20i','xDrive25i','sDrive18d','xDrive20d','xDrive25d')},
    'X3':{years:Y(2003),engines:E('2.0i','2.5i','3.0i','20i','28i','30i','M40i','18d','20d','30d','35d','M40d')},
    'X5':{years:Y(1999),engines:E('3.0i','4.4i','4.8i','30i','40i','50i','M','25d','30d','35d','40d','M50d')},
    'X6':{years:Y(2008),engines:E('30i','35i','40i','50i','M','30d','35d','40d','M50d')},
    'X7':{years:Y(2018),engines:E('40i','M60i','30d','40d','M50d')}
  },
  'Mercedes-Benz':{
    'Klasa A':{years:Y(1997),engines:E('A160','A180','A200','A220','A250','A35 AMG','A45 AMG','A160d','A180d','A200d','A220d')},
    'Klasa B':{years:Y(2005),engines:E('B160','B180','B200','B220','B250','B180d','B200d','B220d')},
    'Klasa C':{years:Y(1993),engines:E('C180','C200','C230','C250','C280','C300','C350','C43 AMG','C63 AMG','C180d','C200d','C220d','C250d','C300d','C350d')},
    'Klasa E':{years:Y(1993),engines:E('E200','E230','E250','E280','E300','E320','E350','E400','E43 AMG','E53 AMG','E63 AMG','E200d','E220d','E250d','E300d','E320 CDI','E350d')},
    'Klasa S':{years:Y(1991),engines:E('S280','S320','S350','S400','S450','S500','S560','S600','S63 AMG','S65 AMG','S320 CDI','S350d','S400d')},
    'CLA':{years:Y(2013),engines:E('CLA180','CLA200','CLA220','CLA250','CLA35 AMG','CLA45 AMG','CLA180d','CLA200d','CLA220d')},
    'CLS':{years:Y(2004),engines:E('CLS250','CLS300','CLS350','CLS400','CLS450','CLS500','CLS53 AMG','CLS63 AMG','CLS220d','CLS250d','CLS350d','CLS400d')},
    'GLA':{years:Y(2013),engines:E('GLA180','GLA200','GLA220','GLA250','GLA35 AMG','GLA45 AMG','GLA180d','GLA200d','GLA220d')},
    'GLC':{years:Y(2015),engines:E('GLC200','GLC250','GLC300','GLC43 AMG','GLC63 AMG','GLC220d','GLC250d','GLC300d','GLC350d')},
    'GLE':{years:Y(2015),engines:E('GLE300','GLE350','GLE400','GLE450','GLE53 AMG','GLE63 AMG','GLE250d','GLE300d','GLE350d','GLE400d')},
    'Vito':{years:Y(1996),engines:E('109 CDI','110 CDI','111 CDI','113 CDI','114 CDI','116 CDI','119 CDI','2.0 benzyna','2.2 CDI','3.0 CDI')},
    'Sprinter':{years:Y(1995),engines:E('208 CDI','211 CDI','213 CDI','214 CDI','215 CDI','216 CDI','311 CDI','313 CDI','314 CDI','315 CDI','316 CDI','319 CDI','2.2 CDI','3.0 CDI')}
  },
  'Volkswagen':{
    'up!':{years:Y(2011),engines:E('1.0 MPI','1.0 TSI','e-up!')},
    'Polo':{years:Y(1981),engines:E('1.0 MPI','1.0 TSI','1.2','1.2 TSI','1.4','1.4 TDI','1.4 TSI','1.6','1.6 TDI','1.8 TSI','2.0 TSI GTI')},
    'Golf':{years:Y(1974),engines:E('1.0 TSI','1.2 TSI','1.4','1.4 TSI','1.5 TSI','1.6','1.6 TDI','1.8T','1.9 TDI','2.0 TDI','2.0 TFSI/TSI','GTI','GTD','R','GTE','e-Golf')},
    'Jetta':{years:Y(1979),engines:E('1.2 TSI','1.4 TSI','1.6','1.6 TDI','1.9 TDI','2.0 TDI','2.0 TSI')},
    'Passat':{years:Y(1973),engines:E('1.4 TSI','1.5 TSI','1.6','1.6 TDI','1.8T','1.8 TSI','1.9 TDI','2.0 TDI','2.0 TSI','2.5 TDI','2.8 V6','3.2 FSI','3.6 FSI','GTE')},
    'Arteon':{years:Y(2017),engines:E('1.5 TSI','2.0 TDI','2.0 TSI','eHybrid','R 2.0 TSI')},
    'Touran':{years:Y(2003),engines:E('1.2 TSI','1.4 TSI','1.5 TSI','1.6 FSI','1.6 TDI','1.9 TDI','2.0 TDI','2.0 FSI')},
    'Tiguan':{years:Y(2007),engines:E('1.4 TSI','1.5 TSI','2.0 TDI','2.0 TSI','eHybrid','R 2.0 TSI')},
    'Touareg':{years:Y(2002),engines:E('2.5 TDI','3.0 TDI','3.2 V6','3.6 FSI','4.2 V8','4.2 TDI','5.0 V10 TDI','6.0 W12','3.0 TSI eHybrid')},
    'Caddy':{years:Y(1995),engines:E('1.0 TSI','1.2 TSI','1.4 TSI','1.6','1.6 TDI','1.9 TDI','2.0 SDI','2.0 TDI')},
    'Transporter':{years:Y(1990),engines:E('1.9 TD','1.9 TDI','2.0 benzyna','2.0 TDI','2.4 D','2.5 TDI','3.2 V6')},
    'Crafter':{years:Y(2006),engines:E('2.0 TDI','2.5 TDI')}
  },
  'Skoda':{
    'Fabia':{years:Y(1999),engines:E('1.0 MPI','1.0 TSI','1.2','1.2 TSI','1.4','1.4 TDI','1.4 TSI','1.6','1.6 TDI','1.9 SDI','1.9 TDI')},
    'Octavia':{years:Y(1996),engines:E('1.0 TSI','1.2 TSI','1.4 TSI','1.5 TSI','1.6 MPI','1.6 TDI','1.8 TSI','1.9 TDI','2.0 TDI','2.0 TSI','RS','iV')},
    'Superb':{years:Y(2001),engines:E('1.4 TSI','1.5 TSI','1.8 TSI','1.9 TDI','2.0 TDI','2.0 TSI','2.5 TDI','2.8 V6','3.6 FSI','iV')},
    'Rapid':{years:Y(2012,2019),engines:E('1.0 TSI','1.2 MPI','1.2 TSI','1.4 TDI','1.4 TSI','1.6 MPI','1.6 TDI')},
    'Scala':{years:Y(2019),engines:E('1.0 TSI','1.5 TSI','1.6 TDI')},
    'Kamiq':{years:Y(2019),engines:E('1.0 TSI','1.5 TSI','1.6 TDI')},
    'Karoq':{years:Y(2017),engines:E('1.0 TSI','1.5 TSI','1.6 TDI','2.0 TDI','2.0 TSI')},
    'Kodiaq':{years:Y(2016),engines:E('1.4 TSI','1.5 TSI','2.0 TDI','2.0 TSI','RS')}
  },
  'SEAT':{
    'Ibiza':{years:Y(1984),engines:E('1.0 MPI','1.0 TSI','1.2','1.2 TSI','1.4','1.4 TDI','1.4 TSI','1.6','1.6 TDI','1.8 TSI')},
    'Leon':{years:Y(1999),engines:E('1.0 TSI','1.2 TSI','1.4 TSI','1.5 TSI','1.6 TDI','1.8 TSI','1.9 TDI','2.0 TDI','2.0 TSI','Cupra')},
    'Toledo':{years:Y(1991,2019),engines:E('1.2 TSI','1.4','1.4 TSI','1.6','1.6 TDI','1.8','1.9 TDI','2.0 TDI')},
    'Exeo':{years:Y(2008,2013),engines:E('1.6','1.8T','1.8 TSI','2.0 TDI','2.0 TSI')},
    'Ateca':{years:Y(2016),engines:E('1.0 TSI','1.4 TSI','1.5 TSI','1.6 TDI','2.0 TDI','2.0 TSI')},
    'Arona':{years:Y(2017),engines:E('1.0 TSI','1.5 TSI','1.6 TDI')},
    'Alhambra':{years:Y(1996,2022),engines:E('1.4 TSI','1.8T','1.9 TDI','2.0 TDI','2.0 TSI','2.8 V6')}
  },
  'Cupra':{
    'Formentor':{years:Y(2020),engines:E('1.5 TSI','2.0 TDI','2.0 TSI','1.4 eHybrid','VZ 2.0 TSI','VZ5 2.5 TFSI')},
    'Leon':{years:Y(2020),engines:E('1.5 eTSI','2.0 TSI','1.4 eHybrid','VZ')},
    'Ateca':{years:Y(2018),engines:E('2.0 TSI')},
    'Born':{years:Y(2021),engines:E('EV')}
  },
  'Opel':{
    'Corsa':{years:Y(1982),engines:E('1.0','1.0 Turbo','1.2','1.2 Turbo','1.3 CDTI','1.4','1.4 Turbo','1.5 D','1.7 D/DTI/CDTI','Electric')},
    'Astra':{years:Y(1991),engines:E('1.2 Turbo','1.4','1.4 Turbo','1.6','1.6 Turbo','1.7 CDTI','1.9 CDTI','2.0 CDTI','2.0 Turbo','Plug-in Hybrid')},
    'Insignia':{years:Y(2008,2022),engines:E('1.4 Turbo','1.5 Turbo','1.6 Turbo','1.6 CDTI','2.0 CDTI','2.0 Turbo','2.8 V6 Turbo')},
    'Mokka':{years:Y(2012),engines:E('1.2 Turbo','1.4 Turbo','1.5 D','1.6','1.6 CDTI','1.7 CDTI','Electric')},
    'Zafira':{years:Y(1999),engines:E('1.6','1.8','1.9 CDTI','2.0 DTI','2.0 Turbo','2.2','2.2 DTI')},
    'Vivaro':{years:Y(2001),engines:E('1.5 D','1.6 CDTI','2.0 CDTI','2.0 DTI','2.5 CDTI','Electric')}
  },
  'Ford':{
    'Fiesta':{years:Y(1976,2023),engines:E('1.0 EcoBoost','1.1','1.25','1.4','1.4 TDCi','1.5 TDCi','1.6','1.6 TDCi','ST 1.5 EcoBoost','ST 1.6 EcoBoost')},
    'Focus':{years:Y(1998),engines:E('1.0 EcoBoost','1.5 EcoBoost','1.5 TDCi','1.6','1.6 EcoBoost','1.6 TDCi','1.8','1.8 TDCi','2.0','2.0 TDCi','ST','RS')},
    'Mondeo':{years:Y(1993,2022),engines:E('1.5 EcoBoost','1.6','1.6 EcoBoost','1.8','1.8 TDCi','2.0','2.0 EcoBoost','2.0 TDCi','2.2 TDCi','2.5T','Hybrid')},
    'Kuga':{years:Y(2008),engines:E('1.5 EcoBoost','1.5 TDCi','1.6 EcoBoost','2.0 TDCi','2.5 Hybrid','2.5 PHEV')},
    'S-Max':{years:Y(2006,2023),engines:E('1.5 EcoBoost','1.8 TDCi','2.0 EcoBoost','2.0 TDCi','2.2 TDCi','2.5T','Hybrid')},
    'Transit':{years:Y(1991),engines:E('2.0 EcoBlue','2.0 TDCi','2.2 TDCi','2.4 TDDI/TDCi','2.5 D','3.2 TDCi')}
  },
  'Peugeot':{
    '206':{years:Y(1998,2012),engines:E('1.1','1.4','1.4 HDi','1.6','1.6 HDi','2.0','2.0 HDi','RC 2.0')},
    '207':{years:Y(2006,2014),engines:E('1.4','1.4 HDi','1.4 VTi','1.6 HDi','1.6 VTi','1.6 THP')},
    '208':{years:Y(2012),engines:E('1.0 VTi','1.2 PureTech','1.4 HDi','1.5 BlueHDi','1.6 BlueHDi','1.6 THP','e-208')},
    '307':{years:Y(2001,2009),engines:E('1.4','1.4 HDi','1.6','1.6 HDi','2.0','2.0 HDi')},
    '308':{years:Y(2007),engines:E('1.2 PureTech','1.4 VTi','1.5 BlueHDi','1.6 HDi','1.6 THP','1.6 VTi','2.0 BlueHDi','2.0 HDi','PHEV')},
    '407':{years:Y(2004,2011),engines:E('1.8','1.6 HDi','2.0','2.0 HDi','2.2','2.2 HDi','2.7 HDi','3.0 V6')},
    '508':{years:Y(2010),engines:E('1.2 PureTech','1.5 BlueHDi','1.6 BlueHDi','1.6 THP','2.0 BlueHDi','2.0 HDi','PHEV')},
    '3008':{years:Y(2009),engines:E('1.2 PureTech','1.5 BlueHDi','1.6 BlueHDi','1.6 HDi','1.6 THP','2.0 BlueHDi','Hybrid/PHEV')},
    '5008':{years:Y(2009),engines:E('1.2 PureTech','1.5 BlueHDi','1.6 BlueHDi','1.6 HDi','1.6 THP','2.0 BlueHDi')},
    'Partner':{years:Y(1996),engines:E('1.4','1.5 BlueHDi','1.6','1.6 BlueHDi','1.6 HDi','1.9 D','2.0 HDi','Electric')}
  },
  'Citroen':{
    'C3':{years:Y(2002),engines:E('1.0 VTi','1.1','1.2 PureTech','1.4','1.4 HDi','1.5 BlueHDi','1.6 BlueHDi','1.6 HDi','1.6 VTi')},
    'C4':{years:Y(2004),engines:E('1.2 PureTech','1.4','1.5 BlueHDi','1.6','1.6 BlueHDi','1.6 HDi','1.6 THP','2.0','2.0 HDi','Electric')},
    'C5':{years:Y(2001),engines:E('1.6 HDi','1.6 THP','1.8','2.0','2.0 HDi','2.2 HDi','2.7 HDi','3.0 HDi','3.0 V6')},
    'Berlingo':{years:Y(1996),engines:E('1.4','1.5 BlueHDi','1.6','1.6 BlueHDi','1.6 HDi','1.9 D','2.0 HDi','Electric')}
  },
  'Renault':{
    'Clio':{years:Y(1990),engines:E('0.9 TCe','1.0 TCe','1.2','1.2 TCe','1.4','1.5 dCi','1.6','1.6 16V','2.0 16V RS','E-Tech Hybrid')},
    'Megane':{years:Y(1995),engines:E('1.2 TCe','1.3 TCe','1.4','1.4 TCe','1.5 dCi','1.6','1.6 dCi','1.8 TCe','1.9 dCi','2.0','2.0 dCi','RS')},
    'Laguna':{years:Y(1994,2015),engines:E('1.5 dCi','1.6','1.8','1.9 dCi','2.0','2.0 dCi','2.0T','2.2 dCi','3.0 V6')},
    'Scenic':{years:Y(1996),engines:E('1.2 TCe','1.3 TCe','1.4','1.5 dCi','1.6','1.6 dCi','1.9 dCi','2.0','2.0 dCi')},
    'Captur':{years:Y(2013),engines:E('0.9 TCe','1.0 TCe','1.2 TCe','1.3 TCe','1.5 dCi','E-Tech Hybrid')},
    'Kadjar':{years:Y(2015,2022),engines:E('1.2 TCe','1.3 TCe','1.5 dCi','1.6 dCi')},
    'Trafic':{years:Y(2001),engines:E('1.6 dCi','2.0 dCi','2.0 benzyna','2.5 dCi')}
  },
  'Fiat':{
    '500':{years:Y(2007),engines:E('0.9 TwinAir','1.0 Hybrid','1.2','1.3 Multijet','1.4','Electric')},
    'Panda':{years:Y(1980),engines:E('0.9 TwinAir','1.0 Hybrid','1.1','1.2','1.3 Multijet','1.4')},
    'Punto':{years:Y(1993,2018),engines:E('1.2','1.3 Multijet','1.4','1.4 T-Jet','1.6 Multijet','1.9 JTD/Multijet')},
    'Tipo':{years:Y(1988),engines:E('1.0 T3','1.4','1.4 T-Jet','1.5 Hybrid','1.6','1.6 Multijet')},
    'Doblo':{years:Y(2000),engines:E('1.3 Multijet','1.4','1.6 Multijet','1.9 JTD','2.0 Multijet')},
    'Ducato':{years:Y(1994),engines:E('2.0 JTD','2.2 Multijet','2.3 Multijet','2.8 JTD','3.0 Multijet')}
  },
  'Toyota':{
    'Yaris':{years:Y(1999),engines:E('1.0','1.3','1.4 D-4D','1.5','1.5 Hybrid','GR 1.6 Turbo')},
    'Corolla':{years:Y(1983),engines:E('1.2 Turbo','1.3','1.4','1.4 D-4D','1.6','1.8 Hybrid','2.0 D-4D','2.0 Hybrid')},
    'Avensis':{years:Y(1997,2018),engines:E('1.6','1.6 D-4D','1.8','2.0','2.0 D-4D','2.2 D-CAT','2.2 D-4D')},
    'Auris':{years:Y(2006,2018),engines:E('1.2 Turbo','1.3','1.4 D-4D','1.6','1.8 Hybrid','2.0 D-4D')},
    'RAV4':{years:Y(1994),engines:E('2.0','2.0 D-4D','2.2 D-CAT','2.2 D-4D','2.5 Hybrid','2.5 PHEV')},
    'Land Cruiser':{years:Y(1984),engines:E('2.4 D','2.8 D-4D','3.0 D-4D','4.0 V6','4.2 D','4.5 D-4D')}
  },
  'Honda':{
    'Civic':{years:Y(1984),engines:E('1.0 VTEC Turbo','1.4','1.5 VTEC Turbo','1.6','1.6 i-DTEC','1.8','2.0','2.0 Type R','2.2 i-CTDi','2.2 i-DTEC','Hybrid')},
    'Accord':{years:Y(1985,2015),engines:E('1.8','2.0','2.2','2.2 i-CTDi','2.2 i-DTEC','2.4')},
    'CR-V':{years:Y(1995),engines:E('1.5 VTEC Turbo','1.6 i-DTEC','2.0','2.0 Hybrid','2.2 i-CTDi','2.2 i-DTEC','2.4')},
    'Jazz':{years:Y(2001),engines:E('1.2','1.3','1.4','1.5','1.5 Hybrid')}
  },
  'Nissan':{
    'Micra':{years:Y(1982),engines:E('0.9 IG-T','1.0','1.0 IG-T','1.2','1.4','1.5 dCi')},
    'Qashqai':{years:Y(2006),engines:E('1.2 DIG-T','1.3 DIG-T','1.5 dCi','1.6','1.6 dCi','2.0','2.0 dCi','e-Power')},
    'X-Trail':{years:Y(2001),engines:E('1.3 DIG-T','1.5 e-Power','1.6 dCi','2.0','2.0 dCi','2.2 dCi','2.5')},
    'Navara':{years:Y(1997),engines:E('2.3 dCi','2.5 dCi','3.0 dCi')},
    'Juke':{years:Y(2010),engines:E('1.0 DIG-T','1.2 DIG-T','1.5 dCi','1.6','1.6 DIG-T','Hybrid')}
  },
  'Mazda':{
    '2':{years:Y(2003),engines:E('1.3','1.4 CD','1.5','1.5 Skyactiv-G','1.5 Skyactiv-D')},
    '3':{years:Y(2003),engines:E('1.5 Skyactiv-G','1.6','1.6 MZ-CD','2.0','2.0 Skyactiv-G','2.2 Skyactiv-D','2.3 MPS','2.5')},
    '6':{years:Y(2002),engines:E('1.8','2.0','2.0 MZR-CD','2.2 Skyactiv-D','2.3','2.3 MPS','2.5 Skyactiv-G')},
    'CX-3':{years:Y(2015),engines:E('1.5 Skyactiv-D','2.0 Skyactiv-G')},
    'CX-5':{years:Y(2012),engines:E('2.0 Skyactiv-G','2.2 Skyactiv-D','2.5 Skyactiv-G')}
  },
  'Hyundai':{
    'i10':{years:Y(2008),engines:E('1.0','1.1','1.2')},
    'i20':{years:Y(2008),engines:E('1.0 T-GDI','1.1 CRDi','1.2','1.4','1.4 CRDi','N 1.6 T-GDI')},
    'i30':{years:Y(2007),engines:E('1.0 T-GDI','1.4','1.4 T-GDI','1.5 T-GDI','1.6 CRDi','1.6 T-GDI','2.0 T-GDI N')},
    'Tucson':{years:Y(2004),engines:E('1.6 GDI','1.6 T-GDI','1.6 CRDi','2.0 CRDi','2.0 benzyna','Hybrid','PHEV')},
    'Santa Fe':{years:Y(2000),engines:E('2.0 CRDi','2.2 CRDi','2.4','2.7 V6','3.3 V6','Hybrid','PHEV')}
  },
  'Kia':{
    'Picanto':{years:Y(2004),engines:E('1.0','1.0 T-GDI','1.1','1.2')},
    'Rio':{years:Y(2000),engines:E('1.0 T-GDI','1.1 CRDi','1.2','1.4','1.4 CRDi','1.5 CRDi')},
    'Ceed':{years:Y(2006),engines:E('1.0 T-GDI','1.4','1.4 T-GDI','1.5 T-GDI','1.6 CRDi','1.6 GDI','1.6 T-GDI')},
    'Sportage':{years:Y(1994),engines:E('1.6 GDI','1.6 T-GDI','1.6 CRDi','2.0','2.0 CRDi','2.7 V6','Hybrid','PHEV')},
    'Sorento':{years:Y(2002),engines:E('2.0 CRDi','2.2 CRDi','2.4','2.5 CRDi','3.3 V6','3.5 V6','Hybrid','PHEV')}
  },
  'Volvo':{
    'S40':{years:Y(1995,2012),engines:E('1.6','1.6D','1.8','2.0','2.0D','2.4','D5','T5')},
    'S60':{years:Y(2000),engines:E('T3','T4','T5','T6','D2','D3','D4','D5','B3','B4','B5','T8 PHEV')},
    'S80':{years:Y(1998,2016),engines:E('2.0T','2.4','2.4D','2.5T','D5','T6','V8')},
    'V40':{years:Y(1995,2019),engines:E('T2','T3','T4','T5','D2','D3','D4')},
    'V60':{years:Y(2010),engines:E('T3','T4','T5','T6','D2','D3','D4','D5','B3','B4','B5','T6 PHEV','T8 PHEV')},
    'V70':{years:Y(1996,2016),engines:E('2.0T','2.4','2.4D','2.5 TDI','2.5T','D5','T5','R')},
    'XC60':{years:Y(2008),engines:E('T5','T6','D3','D4','D5','B4','B5','B6','T6 PHEV','T8 PHEV')},
    'XC90':{years:Y(2002),engines:E('2.5T','3.2','4.4 V8','D5','T5','T6','B5','B6','T8 PHEV')}
  },
  'Dacia':{
    'Logan':{years:Y(2004),engines:E('0.9 TCe','1.0 SCe','1.0 TCe','1.2','1.4','1.5 dCi','1.6')},
    'Sandero':{years:Y(2008),engines:E('0.9 TCe','1.0 SCe','1.0 TCe','1.2','1.5 dCi')},
    'Duster':{years:Y(2010),engines:E('1.0 TCe','1.2 TCe','1.3 TCe','1.5 dCi','1.6','Hybrid')}
  },
  'Alfa Romeo':{
    'Giulietta':{years:Y(2010,2020),engines:E('1.4 TB','1.6 JTDm','1.75 TBi','2.0 JTDm')},
    'Giulia':{years:Y(2016),engines:E('2.0 Turbo','2.2 JTDm','2.9 V6 Quadrifoglio')},
    'Stelvio':{years:Y(2017),engines:E('2.0 Turbo','2.2 JTDm','2.9 V6 Quadrifoglio')},
    '159':{years:Y(2005,2011),engines:E('1.8 MPI','1.75 TBi','1.9 JTDm','2.0 JTDm','2.2 JTS','2.4 JTDm','3.2 JTS V6')}
  },
  'Mitsubishi':{
    'Colt':{years:Y(1992),engines:E('1.1','1.3','1.5','1.5 DI-D','1.5 Turbo')},
    'Lancer':{years:Y(1988,2017),engines:E('1.5','1.6','1.8','2.0 DI-D','2.0 Turbo Evo')},
    'ASX':{years:Y(2010),engines:E('1.6','1.6 DI-D','1.8 DI-D','2.0','2.2 DI-D')},
    'Outlander':{years:Y(2003),engines:E('2.0','2.0 DI-D','2.2 DI-D','2.4','2.4 PHEV')}
  },
  'Subaru':{
    'Impreza':{years:Y(1992),engines:E('1.5','1.6','2.0','2.0D','2.0 Turbo WRX','2.5 Turbo WRX STI')},
    'Forester':{years:Y(1997),engines:E('2.0','2.0D','2.0 Turbo','2.5','2.5 Turbo','e-Boxer')},
    'Legacy':{years:Y(1989),engines:E('2.0','2.0D','2.0 Turbo','2.5','3.0 H6','3.6 H6')},
    'Outback':{years:Y(1995),engines:E('2.0D','2.5','3.0 H6','3.6 H6')}
  },
  'Suzuki':{
    'Swift':{years:Y(1988),engines:E('1.0','1.0 BoosterJet','1.2','1.3','1.3 DDiS','1.4 BoosterJet Sport')},
    'Vitara':{years:Y(1988),engines:E('1.0 BoosterJet','1.4 BoosterJet','1.6','1.6 DDiS','1.9 DDiS','2.0','2.0 HDi','2.4','Hybrid')},
    'SX4':{years:Y(2006),engines:E('1.0 BoosterJet','1.4 BoosterJet','1.6','1.6 DDiS','1.9 DDiS','2.0 DDiS')}
  },
  'Jeep':{
    'Renegade':{years:Y(2014),engines:E('1.0 T3','1.3 T4','1.4 MultiAir','1.6 E-TorQ','1.6 Multijet','2.0 Multijet','4xe PHEV')},
    'Compass':{years:Y(2006),engines:E('1.3 T4','1.4 MultiAir','1.6 Multijet','2.0 Multijet','2.4','4xe PHEV')},
    'Cherokee':{years:Y(1984),engines:E('2.0 Multijet','2.2 Multijet','2.4','2.8 CRD','3.2 V6','3.7 V6')},
    'Grand Cherokee':{years:Y(1993),engines:E('3.0 CRD','3.0 V6','3.6 V6','4.7 V8','5.7 HEMI','6.1 SRT8','6.4 SRT8')}
  },
  'Land Rover':{
    'Freelander':{years:Y(1997,2014),engines:E('1.8','2.0 DI','2.0 Td4','2.2 TD4','2.5 V6')},
    'Discovery':{years:Y(1989),engines:E('2.0 Si4','2.7 TDV6','3.0 SDV6','3.0 TDV6','3.0 Si6','4.0 V6','4.4 V8','5.0 V8')},
    'Range Rover Evoque':{years:Y(2011),engines:E('2.0 Si4','2.0 TD4','2.0 eD4','2.0 D150/D180/D200','PHEV')},
    'Range Rover Sport':{years:Y(2005),engines:E('2.7 TDV6','3.0 SDV6','3.0 TDV6','3.0 Si6','4.2 V8 SC','4.4 V8','5.0 V8 SC')}
  }
}

export const vehicleMakes=Object.keys(vehicleCatalog).sort((a,b)=>a.localeCompare(b,'pl'))
export const vehicleModels=make=>Object.keys(vehicleCatalog[make]||{}).sort((a,b)=>a.localeCompare(b,'pl'))
export const vehicleYears=(make,model)=>vehicleCatalog[make]?.[model]?.years||Y(1980)
export const vehicleEngines=(make,model)=>vehicleCatalog[make]?.[model]?.engines||[]


// Szczegółowy katalog wariantów. To warstwa rozszerzająca katalog podstawowy.
// Rekordy, których tu nie ma, nadal korzystają z list podstawowych i trybu ręcznego.
export const detailedVehicleCatalog = {
  'Volkswagen': {
    'Touran': [
      {generation:'I (1T1/1T2)', from:2003, to:2010, variants:[
        ['1.6 FSI',115,'BAG/BLF/BLP'],['1.9 TDI',90,'BRU/BXF/BXJ'],['1.9 TDI',100,'AVQ'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 FSI',150,'AXW/BLR/BLX/BLY/BVY/BVZ'],['2.0 TDI',136,'AZV'],['2.0 TDI',140,'BKD/BMM'],['2.0 TDI',170,'BMN']
      ]},
      {generation:'I FL (1T3)', from:2010, to:2015, variants:[
        ['1.2 TSI',105,'CBZB'],['1.4 TSI',140,'CAVC'],['1.4 TSI',170,'CAVB'],['1.6 TDI',105,'CAYC'],['2.0 TDI',140,'CFHC'],['2.0 TDI',170,'CFJA']
      ]},
      {generation:'II (5T)', from:2015, to:2026, variants:[
        ['1.2 TSI',110,'CYVB'],['1.4 TSI',150,'CZDA'],['1.5 TSI',150,'DADA/DPCA'],['1.6 TDI',110,'CRKB/CXXB'],['2.0 TDI',150,'DFEA/DFGA'],['2.0 TDI',190,'DFHA']
      ]}
    ],
    'Golf': [
      {generation:'IV (1J)',from:1997,to:2006,variants:[['1.6',100,'AEH/AKL/APF'],['1.8T',150,'AGU/ARZ/AUM'],['1.9 TDI',90,'AGR/ALH'],['1.9 TDI',110,'AHF/ASV'],['1.9 TDI',130,'ASZ'],['1.9 TDI',150,'ARL'],['2.3 V5',150,'AGZ']]},
      {generation:'V (1K)',from:2003,to:2009,variants:[['1.4',80,'BUD'],['1.4 TSI',122,'CAXA'],['1.4 TSI',140,'BMY'],['1.6',102,'BGU/BSE/BSF'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 TDI',140,'BKD/BMM'],['2.0 TFSI GTI',200,'AXX/BWA'],['2.0 TFSI R',270,'CDLF']]},
      {generation:'VI (5K)',from:2008,to:2013,variants:[['1.2 TSI',105,'CBZB'],['1.4 TSI',122,'CAXA'],['1.4 TSI',160,'CAVD'],['1.6 TDI',105,'CAYC'],['2.0 TDI',140,'CFFB'],['2.0 TSI GTI',211,'CCZB'],['2.0 TSI R',270,'CDLF']]},
      {generation:'VII (5G)',from:2012,to:2020,variants:[['1.0 TSI',115,'CHZD'],['1.2 TSI',105,'CJZA'],['1.4 TSI',125,'CZCA'],['1.4 TSI',150,'CZDA'],['1.5 TSI',150,'DADA'],['1.6 TDI',105,'CLHA'],['2.0 TDI',150,'CRBC'],['2.0 TSI GTI',220,'CHHB'],['2.0 TSI R',300,'CJXC']]},
      {generation:'VIII (CD)',from:2019,to:2026,variants:[['1.0 TSI',110,'DLAA'],['1.5 TSI',130,'DPBA'],['1.5 TSI',150,'DPCA'],['2.0 TDI',115,'DTRB'],['2.0 TDI',150,'DTSB'],['2.0 TSI GTI',245,'DNPA'],['2.0 TSI R',320,'DNFG']]}
    ],
    'Passat': [
      {generation:'B5/B5.5 (3B)',from:1996,to:2005,variants:[['1.8T',150,'AEB/ANB/AWT'],['1.9 TDI',90,'AHU/AGR'],['1.9 TDI',110,'AFN/AVG'],['1.9 TDI',130,'AVF/AWX'],['2.5 V6 TDI',150,'AFB/AKN'],['2.5 V6 TDI',180,'BAU/BDH']]},
      {generation:'B6 (3C)',from:2005,to:2010,variants:[['1.4 TSI',122,'CAXA'],['1.8 TSI',160,'BZB/CDAA'],['2.0 TFSI',200,'AXX/BWA'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 TDI',140,'BKD/BKP/BMP'],['2.0 TDI',170,'BMR/CBBB']]},
      {generation:'B7 (36)',from:2010,to:2014,variants:[['1.4 TSI',122,'CAXA'],['1.8 TSI',160,'CDAA'],['2.0 TSI',210,'CCZB'],['1.6 TDI',105,'CAYC'],['2.0 TDI',140,'CFFB'],['2.0 TDI',170,'CFGB']]},
      {generation:'B8 (3G)',from:2014,to:2023,variants:[['1.4 TSI',150,'CZDA'],['1.5 TSI',150,'DADA'],['2.0 TSI',220,'CHHB'],['1.6 TDI',120,'DCXA'],['2.0 TDI',150,'CRLB/DFGA'],['2.0 TDI',190,'DDAA'],['2.0 BiTDI',240,'CUAA']]}
    ],
    'Tiguan': [
      {generation:'I (5N)',from:2007,to:2016,variants:[['1.4 TSI',150,'CAVA'],['1.4 TSI',160,'CAVD'],['2.0 TSI',200,'CAWA'],['2.0 TSI',211,'CCZB'],['2.0 TDI',140,'CFFB'],['2.0 TDI',170,'CFGB']]},
      {generation:'II (AD/BW)',from:2016,to:2024,variants:[['1.4 TSI',150,'CZDA'],['1.5 TSI',150,'DADA'],['2.0 TSI',180,'CZPA'],['2.0 TSI',220,'CHHB'],['2.0 TDI',150,'DFGA'],['2.0 TDI',190,'DFHA'],['2.0 BiTDI',240,'CUAA']]},
      {generation:'III',from:2024,to:2026,variants:[['1.5 eTSI',150,'EA211 evo2'],['2.0 TDI',150,'EA288 evo'],['2.0 TSI',204,'EA888 evo4']]}
    ]
  },
  'Audi': {
    'A3': [
      {generation:'8L',from:1996,to:2003,variants:[['1.8T',150,'AGU/AUM/ARZ'],['1.9 TDI',90,'AGR/ALH'],['1.9 TDI',110,'AHF/ASV'],['1.9 TDI',130,'ASZ']]},
      {generation:'8P',from:2003,to:2013,variants:[['1.4 TFSI',125,'CAXC'],['1.8 TFSI',160,'CDAA'],['2.0 TFSI',200,'AXX/BWA'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 TDI',140,'BKD/CFFB'],['2.0 TDI',170,'BMN/CFGB'],['S3 2.0 TFSI',265,'BHZ/CDLA']]},
      {generation:'8V',from:2012,to:2020,variants:[['1.4 TFSI',125,'CZCA'],['1.4 TFSI',150,'CZEA'],['1.5 TFSI',150,'DADA'],['1.6 TDI',110,'CRKB'],['2.0 TDI',150,'CRBC'],['2.0 TFSI',190,'DKZA'],['S3 2.0 TFSI',300,'CJXC'],['RS3 2.5 TFSI',367,'CZGB']]},
      {generation:'8Y',from:2020,to:2026,variants:[['1.0 TFSI',110,'DLAA'],['1.5 TFSI',150,'DPCA'],['2.0 TDI',150,'DTSB'],['S3 2.0 TFSI',310,'DNFB'],['RS3 2.5 TFSI',400,'DNWA']]}
    ],
    'A4': [
      {generation:'B6 (8E)',from:2000,to:2004,variants:[['1.8T',150,'AVJ'],['1.8T',163,'BFB'],['1.9 TDI',101,'AVB'],['1.9 TDI',130,'AVF/AWX'],['2.5 TDI',180,'AKE/BAU']]},
      {generation:'B7 (8E)',from:2004,to:2008,variants:[['1.8T',163,'BFB'],['2.0 TFSI',200,'BGB/BWE'],['1.9 TDI',115,'BRB'],['2.0 TDI',140,'BLB/BRE'],['2.0 TDI',170,'BRD'],['3.0 TDI',233,'ASB']]},
      {generation:'B8 (8K)',from:2007,to:2015,variants:[['1.8 TFSI',160,'CDHB'],['2.0 TFSI',211,'CDNC'],['2.0 TDI',143,'CAGA'],['2.0 TDI',170,'CAHA'],['3.0 TDI',240,'CCWA'],['3.0 TFSI S4',333,'CAKA']]},
      {generation:'B9 (8W)',from:2015,to:2026,variants:[['1.4 TFSI',150,'CVNA'],['2.0 TFSI',190,'DEMA'],['2.0 TFSI',252,'CYRB'],['2.0 TDI',150,'DEUA'],['2.0 TDI',190,'DESA'],['3.0 TDI',272,'CRTE']]}
    ],
    'A5': [
      {generation:'8T/8F',from:2007,to:2016,variants:[['1.8 TFSI',160,'CDHB'],['2.0 TFSI',211,'CDNC'],['2.0 TDI',170,'CAHA'],['2.7 TDI',190,'CAMA'],['3.0 TDI',240,'CCWA'],['3.0 TFSI S5',333,'CAKA']]},
      {generation:'F5',from:2016,to:2026,variants:[['2.0 TFSI',190,'DEMA'],['2.0 TFSI',252,'CYRB'],['2.0 TDI',190,'DESA'],['3.0 TDI',286,'DCPC'],['S5 3.0 TFSI',354,'CWGD'],['RS5 2.9 TFSI',450,'DECA']]}
    ]
  },
  'Skoda': {
    'Octavia': [
      {generation:'I (1U)',from:1996,to:2010,variants:[['1.6 MPI',102,'BFQ'],['1.8T',150,'AGU/ARX'],['1.9 TDI',90,'AGR/ALH'],['1.9 TDI',110,'AHF/ASV'],['1.9 TDI',130,'ASZ']]},
      {generation:'II (1Z)',from:2004,to:2013,variants:[['1.4 TSI',122,'CAXA'],['1.8 TSI',160,'BZB/CDAA'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 TDI',140,'BKD/BMM'],['2.0 TFSI RS',200,'BWA']]},
      {generation:'III (5E)',from:2012,to:2020,variants:[['1.2 TSI',105,'CJZA'],['1.4 TSI',140,'CHPA'],['1.4 TSI',150,'CZDA'],['1.6 TDI',105,'CLHA'],['2.0 TDI',150,'CRMB'],['2.0 TSI RS',220,'CHHB']]},
      {generation:'IV (NX)',from:2019,to:2026,variants:[['1.0 TSI',110,'DLAA'],['1.5 TSI',150,'DPCA'],['2.0 TDI',115,'DTRB'],['2.0 TDI',150,'DTSB'],['2.0 TSI RS',245,'DNPA']]}
    ]
  },
  'SEAT': {
    'Leon': [
      {generation:'1M',from:1999,to:2006,variants:[['1.8T',180,'AUQ'],['1.9 TDI',90,'AGR/ALH'],['1.9 TDI',110,'ASV'],['1.9 TDI',130,'ASZ'],['1.9 TDI',150,'ARL']]},
      {generation:'1P',from:2005,to:2012,variants:[['1.4 TSI',125,'CAXC'],['1.8 TSI',160,'CDAA'],['1.9 TDI',105,'BKC/BLS/BXE'],['2.0 TDI',140,'BKD'],['2.0 TFSI FR',200,'BWA'],['2.0 TFSI Cupra',240,'BWJ']]},
      {generation:'5F',from:2012,to:2020,variants:[['1.2 TSI',105,'CJZA'],['1.4 TSI',150,'CZEA'],['1.6 TDI',110,'CRKB'],['2.0 TDI',150,'CRBC'],['1.8 TSI',180,'CJSA'],['2.0 TSI Cupra',280,'CJXA']]},
      {generation:'KL',from:2020,to:2026,variants:[['1.0 TSI',110,'DLAA'],['1.5 TSI',150,'DPCA'],['2.0 TDI',150,'DTSB'],['2.0 TSI',190,'DNNA']]}
    ],
    'Exeo': [{generation:'3R',from:2008,to:2013,variants:[['1.8T',150,'CFMA'],['1.8 TSI',160,'CDHB'],['2.0 TSI',200,'BWE'],['2.0 TDI',120,'CAGC'],['2.0 TDI',143,'CAGA'],['2.0 TDI',170,'CAHA']]}]
  },
  'BMW': {
    'Seria 3': [
      {generation:'E46',from:1998,to:2006,variants:[['318i',143,'N42B20/N46B20'],['320i',170,'M54B22'],['325i',192,'M54B25'],['330i',231,'M54B30'],['318d',116,'M47D20'],['320d',150,'M47TUD20'],['330d',204,'M57D30']]},
      {generation:'E90/E91/E92/E93',from:2005,to:2013,variants:[['318i',143,'N43B20'],['320i',170,'N43B20'],['325i',218,'N52B25/N53B30'],['330i',272,'N53B30'],['335i',306,'N54B30/N55B30'],['318d',143,'N47D20'],['320d',177,'N47D20'],['330d',245,'N57D30']]},
      {generation:'F30/F31/F34',from:2012,to:2019,variants:[['318i',136,'B38B15'],['320i',184,'N20B20/B48B20'],['328i',245,'N20B20'],['330i',252,'B48B20'],['340i',326,'B58B30'],['318d',150,'B47D20'],['320d',190,'B47D20'],['330d',258,'N57D30']]},
      {generation:'G20/G21',from:2019,to:2026,variants:[['318i',156,'B48B20'],['320i',184,'B48B20'],['330i',258,'B48B20'],['M340i',374,'B58B30'],['318d',150,'B47D20'],['320d',190,'B47D20'],['330d',286,'B57D30']]}
    ],
    'Seria 5': [
      {generation:'E60/E61',from:2003,to:2010,variants:[['520i',170,'N43B20'],['525i',218,'N52B25'],['530i',272,'N53B30'],['535i',306,'N54B30'],['520d',177,'N47D20'],['525d',197,'M57D30'],['530d',235,'M57D30'],['535d',286,'M57D30']]},
      {generation:'F10/F11',from:2010,to:2017,variants:[['520i',184,'N20B20'],['528i',245,'N20B20'],['535i',306,'N55B30'],['520d',190,'B47D20'],['525d',218,'N47D20'],['530d',258,'N57D30'],['535d',313,'N57D30']]},
      {generation:'G30/G31',from:2017,to:2024,variants:[['520i',184,'B48B20'],['530i',252,'B48B20'],['540i',340,'B58B30'],['520d',190,'B47D20'],['530d',265,'B57D30'],['540d',320,'B57D30']]}
    ]
  },
  'Mercedes-Benz': {
    'Klasa C': [
      {generation:'W203',from:2000,to:2007,variants:[['C180 Kompressor',143,'M271'],['C200 Kompressor',163,'M271'],['C220 CDI',150,'OM646'],['C270 CDI',170,'OM612'],['C320 CDI',224,'OM642']]},
      {generation:'W204',from:2007,to:2015,variants:[['C180',156,'M271/M274'],['C200',184,'M271/M274'],['C250',204,'M271/M274'],['C220 CDI',170,'OM651'],['C250 CDI',204,'OM651'],['C350 CDI',265,'OM642'],['C63 AMG',457,'M156']]},
      {generation:'W205',from:2014,to:2021,variants:[['C180',156,'M274'],['C200',184,'M274/M264'],['C300',245,'M274'],['C220d',170,'OM651'],['C220d',194,'OM654'],['C250d',204,'OM651'],['C43 AMG',390,'M276'],['C63 AMG',476,'M177']]},
      {generation:'W206',from:2021,to:2026,variants:[['C180',170,'M254'],['C200',204,'M254'],['C220d',200,'OM654M'],['C300d',265,'OM654M'],['C43 AMG',408,'M139l']]}
    ],
    'Klasa E': [
      {generation:'W211',from:2002,to:2009,variants:[['E200 Kompressor',184,'M271'],['E280 CDI',190,'OM642'],['E320 CDI',224,'OM642'],['E350',272,'M272'],['E500',388,'M273']]},
      {generation:'W212',from:2009,to:2016,variants:[['E200',184,'M274'],['E250',211,'M274'],['E220 CDI',170,'OM651'],['E250 CDI',204,'OM651'],['E350 CDI',265,'OM642'],['E63 AMG',525,'M157']]},
      {generation:'W213',from:2016,to:2023,variants:[['E200',184,'M274/M264'],['E300',245,'M274'],['E220d',194,'OM654'],['E300d',245,'OM654'],['E400d',340,'OM656'],['E53 AMG',435,'M256']]}
    ]
  }
}

const details=(make,model)=>detailedVehicleCatalog[make]?.[model]||[]
export const vehicleGenerations=(make,model)=>details(make,model).map(x=>x.generation)
export const generationRecord=(make,model,generation)=>details(make,model).find(x=>x.generation===generation)||null
export const generationYears=(make,model,generation)=>{
  const g=generationRecord(make,model,generation)
  return g?Y(g.from,Math.min(g.to,new Date().getFullYear())):vehicleYears(make,model)
}
export const generationEngineNames=(make,model,generation)=>{
  const g=generationRecord(make,model,generation)
  return g?[...new Set(g.variants.map(v=>v[0]))]:vehicleEngines(make,model)
}
export const enginePowers=(make,model,generation,engine)=>{
  const g=generationRecord(make,model,generation)
  return g?[...new Set(g.variants.filter(v=>v[0]===engine).map(v=>String(v[1])))]:[]
}
export const engineCodes=(make,model,generation,engine,power)=>{
  const g=generationRecord(make,model,generation)
  if(!g)return []
  const rows=g.variants.filter(v=>v[0]===engine && (!power||String(v[1])===String(power)))
  return [...new Set(rows.flatMap(v=>String(v[2]||'').split('/').map(x=>x.trim()).filter(Boolean)))]
}
