export default function CrtFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="crt-bulge-filter">
        <feImage
          result="displacementMap"
          xlinkHref="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='70%25'%3E%3Cstop offset='0%25' stop-color='%23808080'/%3E%3Cstop offset='100%25' stop-color='%23000000'/%3E%3C/radialGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="displacementMap"
          scale="40"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}