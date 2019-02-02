import React, {useState, useEffect} from 'react'


export function ECOMPage() {
    return (
        <main id="mainContent" data-grid="container">
            <HeloItem/>
            <div className="m-hero">
                
            </div>
            <Item2Layout/>
            <div data-grid="col-12 stack-3" className="m-hyperlink-group-content-placement"> 
                
            </div>
            <div data-grid="col-12" className="m-product-placement f-device"> ... </div>
            <div data-grid="col-12" className="m-product-placement f-app"> ... </div>
        </main>
    )
}
// https://www.microsoft.com/en-us/mwf/latest/modules/hero-item
export function HeloItem() {

    return (
        <section className="m-hero-item f-x-left f-y-top context-accessory theme-dark" itemScope="" itemType="https://schema.org/Product">
            <picture>
                <source srcSet="https://placehold.it/1600x600/2F2F2F/171717" media="(min-width: 1779px)"/>
                <source srcSet="https://placehold.it/1600x600/2F2F2F/171717" media="(min-width: 1400px)"/>
                <source srcSet="https://placehold.it/1259x472/2F2F2F/171717" media="(min-width: 1084px)"/>
                <source srcSet="https://placehold.it/1083x609/2F2F2F/171717" media="(min-width:768px)"/>
                <source srcSet="https://placehold.it/767x431/2F2F2F/171717" media="(min-width:540px)"/>
                <source srcSet="https://placehold.it/539x303/2F2F2F/171717" media="(min-width:0)"/>
                <img srcSet="https://placehold.it/1259x472/2F2F2F/171717" src="https://placehold.it/1259x472/2F2F2F/171717" alt="Placeholder with grey background and dimension watermark without any imagery"/>
            </picture>
            <div>
                <div>
                    <h1 className="c-heading">Heading</h1>
                    <p className="c-subheading">Subheading</p>
                    <div className="c-price" itemProp="offers" itemScope="" itemType="https://schema.org/Offer">
                        <meta itemProp="priceCurrency" content="USD"/>
                        <span>$</span>
                        <span itemProp="price">10</span>
                        <link itemProp="availability" href="https://schema.org/InStock"/>
                    </div>
                    <div>
                        <a href="#" className="c-call-to-action c-glyph">
                            <span>Call To Action</span>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

function Item2Layout() {
    return (
        <div className="m-content-placement" data-grid="col-12">
            <div data-grid="col-12 pad-6x stack-2">
                <div data-grid="col-6">
                    <section className="m-content-placement-item f-size-large">
                        <picture>
                            <source srcSet="https://placehold.it/740x417" media="(min-width: 1400px)"/>
                            <source srcSet="https://placehold.it/582x328" media="(min-width: 1084px)"/>
                            <source srcSet="https://placehold.it/494x278" media="(min-width: 768px)"/>
                            <source srcSet="https://placehold.it/720x405" media="(min-width: 540px)"/>
                            <source srcSet="https://placehold.it/491x276" media="(min-width:0)"/>
                            <img srcSet="https://placehold.it/491x276" src="https://placehold.it/491x276" alt="Placeholder with grey background and dimension watermark without any imagery"/>
                        </picture>
                        <div>
                            <strong className="c-badge f-small f-highlight">BADGE</strong>
                            <h3 className="c-heading">Heading</h3>
                            <p className="c-paragraph">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut id faucibus ex, eget aliquet ligula. Sed vel ligula consequat, euismod ligula quis, pharetra magna. Fusce commodo pretium tellus non ultricies. Vestibulum fringilla tempor
                                lectus, at pharetra lacus lobortis vel.</p>
                            <a href="#" className="c-call-to-action c-glyph">
                                <span>Call To Action</span>
                            </a>
                        </div>
                    </section>
                </div>
                <div data-grid="col-6">
                    <section className="m-content-placement-item f-size-large">
                        <picture>
                            <source srcSet="https://placehold.it/740x417" media="(min-width: 1400px)"/>
                            <source srcSet="https://placehold.it/582x328" media="(min-width: 1084px)"/>
                            <source srcSet="https://placehold.it/494x278" media="(min-width: 768px)"/>
                            <source srcSet="https://placehold.it/720x405" media="(min-width: 540px)"/>
                            <source srcSet="https://placehold.it/491x276" media="(min-width:0)"/>
                            <img srcSet="https://placehold.it/491x276" src="https://placehold.it/491x276" alt="Placeholder with grey background and dimension watermark without any imagery"/>
                        </picture>
                        <div>
                            <h3 className="c-heading">Heading</h3>
                            <p className="c-paragraph">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut id faucibus ex, eget aliquet ligula. Sed vel ligula consequat, euismod ligula quis, pharetra magna. Fusce commodo pretium tellus non ultricies. Vestibulum fringilla tempor
                                lectus, at pharetra lacus lobortis vel.</p>
                            <a href="#" className="c-call-to-action c-glyph">
                                <span>Call To Action</span>
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}